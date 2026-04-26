"""Integration tests for /api/v1/ai-reports."""

from app.core.config import settings
from app.core.security import hash_password
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.user import User
from app.services import ai_report as ai_report_service


def _create_foreign_area_node(db, crop_type_id: int):
    foreign_user = User(
        correo="cliente_ai_externo@test.com",
        contrasena_hash=hash_password("cliente2pass"),
        nombre_completo="Cliente IA Externo",
        rol="cliente",
        activo=True,
    )
    db.add(foreign_user)
    db.flush()

    foreign_client = Client(
        usuario_id=foreign_user.id,
        nombre_empresa="Empresa IA Externa",
        telefono="555-0009",
        direccion="Calle IA 999",
    )
    db.add(foreign_client)
    db.flush()

    foreign_property = Property(
        cliente_id=foreign_client.id,
        nombre="Rancho IA Externo",
        ubicacion="Durango, MX",
    )
    db.add(foreign_property)
    db.flush()

    foreign_area = IrrigationArea(
        predio_id=foreign_property.id,
        tipo_cultivo_id=crop_type_id,
        nombre="Area IA Externa",
        tamano_area=4.5,
    )
    db.add(foreign_area)
    db.flush()

    foreign_node = Node(
        area_riego_id=foreign_area.id,
        api_key="ak_ai_foreign_node_001",
        nombre="Nodo IA Externo",
        latitud=27.0000,
        longitud=-108.0000,
        activo=True,
    )
    db.add(foreign_node)
    db.commit()
    db.refresh(foreign_area)
    db.refresh(foreign_node)
    return foreign_area, foreign_node


class TestAIReportsApi:
    def test_admin_generates_reports_and_client_sees_only_owned(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        sample_crop_type,
        sample_irrigation_area,
        sample_node,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "AI_REPORTS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", False)

        foreign_area, _ = _create_foreign_area_node(db, sample_crop_type.id)

        own_resp = client.post(
            "/api/v1/ai-reports/generate",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "start_datetime": "2026-04-01T00:00:00Z",
                "end_datetime": "2026-04-02T00:00:00Z",
                "notify": False,
                "force": True,
            },
        )
        assert own_resp.status_code == 200
        own_report_id = own_resp.json()["report_ids"][0]

        foreign_resp = client.post(
            "/api/v1/ai-reports/generate",
            headers=admin_headers,
            json={
                "irrigation_area_id": foreign_area.id,
                "start_datetime": "2026-04-01T00:00:00Z",
                "end_datetime": "2026-04-02T00:00:00Z",
                "notify": False,
                "force": True,
            },
        )
        assert foreign_resp.status_code == 200
        foreign_report_id = foreign_resp.json()["report_ids"][0]

        client_list = client.get("/api/v1/ai-reports", headers=client_headers)
        assert client_list.status_code == 200
        client_payload = client_list.json()
        assert client_payload["total"] == 1
        assert client_payload["data"][0]["irrigation_area_id"] == sample_irrigation_area.id

        admin_list = client.get("/api/v1/ai-reports", headers=admin_headers)
        assert admin_list.status_code == 200
        assert admin_list.json()["total"] == 2

        own_detail = client.get(
            f"/api/v1/ai-reports/{own_report_id}",
            headers=client_headers,
        )
        assert own_detail.status_code == 200

        foreign_detail = client.get(
            f"/api/v1/ai-reports/{foreign_report_id}",
            headers=client_headers,
        )
        assert foreign_detail.status_code == 403

    def test_client_cannot_trigger_generation(
        self,
        client,
        client_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "AI_REPORTS_ENABLED", True)

        resp = client.post(
            "/api/v1/ai-reports/generate",
            headers=client_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "start_datetime": "2026-04-01T00:00:00Z",
                "end_datetime": "2026-04-02T00:00:00Z",
                "notify": False,
            },
        )
        assert resp.status_code == 403

    def test_generate_rejects_invalid_range(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "AI_REPORTS_ENABLED", True)

        resp = client.post(
            "/api/v1/ai-reports/generate",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "start_datetime": "2026-04-02T00:00:00Z",
                "end_datetime": "2026-04-01T00:00:00Z",
                "notify": False,
            },
        )
        assert resp.status_code == 422

    def test_generate_skips_duplicate_range_without_force(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "AI_REPORTS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", False)

        payload = {
            "irrigation_area_id": sample_irrigation_area.id,
            "start_datetime": "2026-04-01T00:00:00Z",
            "end_datetime": "2026-04-02T00:00:00Z",
            "notify": False,
            "force": False,
        }

        first = client.post("/api/v1/ai-reports/generate", headers=admin_headers, json=payload)
        assert first.status_code == 200
        assert first.json()["generated_count"] == 1
        assert first.json()["skipped_count"] == 0

        second = client.post(
            "/api/v1/ai-reports/generate",
            headers=admin_headers,
            json=payload,
        )
        assert second.status_code == 200
        second_data = second.json()
        assert second_data["generated_count"] == 0
        assert second_data["skipped_count"] == 1
        assert second_data["failed_count"] == 0

    def test_generate_marks_failed_when_content_generation_crashes(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "AI_REPORTS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", False)

        def _crash_report_content(_context):
            raise RuntimeError("forced-report-crash")

        monkeypatch.setattr(ai_report_service, "_generate_report_content", _crash_report_content)

        resp = client.post(
            "/api/v1/ai-reports/generate",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "start_datetime": "2026-04-03T00:00:00Z",
                "end_datetime": "2026-04-04T00:00:00Z",
                "notify": False,
                "force": True,
            },
        )
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["generated_count"] == 0
        assert payload["failed_count"] == 1
