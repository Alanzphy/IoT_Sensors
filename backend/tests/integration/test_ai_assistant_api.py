"""Integration tests for /api/v1/ai-assistant/chat."""

from app.core.config import settings
from app.core.security import hash_password
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.user import User

SENSOR_PAYLOAD = {
    "timestamp": "2026-04-10T10:00:00Z",
    "soil": {
        "conductivity": 2.2,
        "temperature": 21.4,
        "humidity": 34.2,
        "water_potential": -0.9,
    },
    "irrigation": {
        "active": True,
        "accumulated_liters": 920.0,
        "flow_per_minute": 8.9,
    },
    "environmental": {
        "temperature": 30.1,
        "relative_humidity": 42.0,
        "wind_speed": 8.1,
        "solar_radiation": 710.0,
        "eto": 5.8,
    },
}


class TestAIAssistantApi:
    def _create_foreign_area_node(self, db, crop_type_id: int):
        foreign_user = User(
            correo="cliente_chat_externo@test.com",
            contrasena_hash=hash_password("clientepass2"),
            nombre_completo="Cliente Chat Externo",
            rol="cliente",
            activo=True,
        )
        db.add(foreign_user)
        db.flush()

        foreign_client = Client(
            usuario_id=foreign_user.id,
            nombre_empresa="Empresa Chat Externa",
            telefono="555-0202",
            direccion="Calle Chat 202",
        )
        db.add(foreign_client)
        db.flush()

        foreign_property = Property(
            cliente_id=foreign_client.id,
            nombre="Predio Chat Externo",
            ubicacion="Durango, MX",
        )
        db.add(foreign_property)
        db.flush()

        foreign_area = IrrigationArea(
            predio_id=foreign_property.id,
            tipo_cultivo_id=crop_type_id,
            nombre="Area Chat Externa",
            tamano_area=7.2,
        )
        db.add(foreign_area)
        db.flush()

        foreign_node = Node(
            area_riego_id=foreign_area.id,
            api_key="ak_foreign_chat_001",
            nombre="Nodo Chat Externo",
            latitud=26.982,
            longitud=-107.123,
            activo=True,
        )
        db.add(foreign_node)
        db.commit()
        db.refresh(foreign_area)
        db.refresh(foreign_node)
        return foreign_client, foreign_area, foreign_node

    def test_admin_can_ask_chat(
        self,
        client,
        admin_headers,
        node_headers,
    ):
        ingest = client.post("/api/v1/readings", headers=node_headers, json=SENSOR_PAYLOAD)
        assert ingest.status_code == 201

        resp = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "Dame un resumen operativo de las ultimas horas.",
                "hours_back": 24,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"]
        assert data["source"] in {"ai", "fallback"}
        assert "metadata" in data

    def test_out_of_scope_question_is_rejected(
        self,
        client,
        admin_headers,
    ):
        resp = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "Dame la receta de un huevo ranchero",
                "hours_back": 24,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "fallback"
        assert data["metadata"]["reason"] == "out_of_scope_question"
        assert data["widgets"] == []
        assert "riego iot" in data["answer"].lower()

    def test_math_only_question_is_rejected(
        self,
        client,
        admin_headers,
    ):
        resp = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "2 + 2",
                "hours_back": 24,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "fallback"
        assert data["metadata"]["reason"] == "out_of_scope_question"
        assert data["widgets"] == []
        assert "riego iot" in data["answer"].lower()

    def test_off_topic_followup_with_domain_history_is_rejected(
        self,
        client,
        admin_headers,
    ):
        resp = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "Como se llama el dinosaurio con patas cortas?",
                "history": [
                    {"role": "user", "content": "Dame estado de humedad y flujo"},
                    {"role": "assistant", "content": "Resumen operativo listo"},
                ],
                "hours_back": 24,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "fallback"
        assert data["metadata"]["reason"] == "out_of_scope_question"
        assert data["widgets"] == []
        assert "riego iot" in data["answer"].lower()

    def test_client_can_ask_chat_in_owned_scope(
        self,
        client,
        client_headers,
        node_headers,
    ):
        ingest = client.post("/api/v1/readings", headers=node_headers, json=SENSOR_PAYLOAD)
        assert ingest.status_code == 201

        resp = client.post(
            "/api/v1/ai-assistant/chat",
            headers=client_headers,
            json={
                "message": "Como esta mi humedad y flujo en las ultimas 24 horas?",
                "hours_back": 24,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"]
        assert data["source"] in {"ai", "fallback"}

    def test_client_cannot_query_foreign_area_scope(
        self,
        client,
        db,
        client_headers,
        sample_crop_type,
    ):
        _, foreign_area, _ = self._create_foreign_area_node(db, sample_crop_type.id)

        resp = client.post(
            "/api/v1/ai-assistant/chat",
            headers=client_headers,
            json={
                "message": "Dame estado del area externa",
                "irrigation_area_id": foreign_area.id,
                "hours_back": 24,
            },
        )
        assert resp.status_code == 403

    def test_rate_limit_blocks_excessive_requests(
        self,
        client,
        admin_headers,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "AI_ASSISTANT_RATE_LIMIT_WINDOW_MINUTES", 60)
        monkeypatch.setattr(settings, "AI_ASSISTANT_RATE_LIMIT_MAX_REQUESTS", 1)

        first = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "Primera consulta",
                "hours_back": 24,
            },
        )
        assert first.status_code == 200

        second = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "Segunda consulta bloqueada",
                "hours_back": 24,
            },
        )
        assert second.status_code == 429

    def test_admin_can_view_ai_usage_and_client_cannot(
        self,
        client,
        admin_headers,
        client_headers,
    ):
        ask = client.post(
            "/api/v1/ai-assistant/chat",
            headers=admin_headers,
            json={
                "message": "Genera telemetria de uso",
                "hours_back": 24,
            },
        )
        assert ask.status_code == 200

        usage = client.get("/api/v1/ai-assistant/usage?hours=24", headers=admin_headers)
        assert usage.status_code == 200
        payload = usage.json()
        assert payload["total"] >= 1
        assert payload["summary"]["total_requests"] >= 1
        assert len(payload["data"]) >= 1

        denied = client.get("/api/v1/ai-assistant/usage?hours=24", headers=client_headers)
        assert denied.status_code == 403
