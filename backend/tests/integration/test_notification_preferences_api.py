"""Integration tests for /api/v1/notification-preferences and dispatch preference gating."""

from app.core.config import settings
from app.core.security import hash_password
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.user import User
from app.services import alert as alert_service

SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T10:00:00Z",
    "soil": {
        "conductivity": 2.5,
        "temperature": 22.3,
        "humidity": 45.6,
        "water_potential": -0.8,
    },
    "irrigation": {
        "active": True,
        "accumulated_liters": 1250.0,
        "flow_per_minute": 8.3,
    },
    "environmental": {
        "temperature": 28.1,
        "relative_humidity": 55.0,
        "wind_speed": 12.5,
        "solar_radiation": 650.0,
        "eto": 5.2,
    },
}


def _create_foreign_area_node(db, crop_type_id: int):
    foreign_user = User(
        correo="pref_cliente2@test.com",
        contrasena_hash=hash_password("cliente2pass"),
        nombre_completo="Cliente Dos",
        rol="cliente",
        activo=True,
    )
    db.add(foreign_user)
    db.flush()

    foreign_client = Client(
        usuario_id=foreign_user.id,
        nombre_empresa="Empresa Dos",
        telefono="555-0002",
        direccion="Calle Dos 456",
    )
    db.add(foreign_client)
    db.flush()

    foreign_property = Property(
        cliente_id=foreign_client.id,
        nombre="Rancho Externo",
        ubicacion="Sonora, MX",
    )
    db.add(foreign_property)
    db.flush()

    foreign_area = IrrigationArea(
        predio_id=foreign_property.id,
        tipo_cultivo_id=crop_type_id,
        nombre="Area Externa",
        tamano_area=7.0,
    )
    db.add(foreign_area)
    db.flush()

    foreign_node = Node(
        area_riego_id=foreign_area.id,
        api_key="ak_pref_foreign_node_001",
        nombre="Nodo Externo",
        latitud=27.0000,
        longitud=-108.0000,
        activo=True,
    )
    db.add(foreign_node)
    db.commit()
    db.refresh(foreign_area)
    db.refresh(foreign_node)
    return foreign_area, foreign_node


class TestNotificationPreferencesApi:
    def test_client_can_bulk_upsert_and_list_own_preferences(
        self,
        client,
        client_headers,
        sample_irrigation_area,
    ):
        upsert = client.put(
            "/api/v1/notification-preferences/bulk",
            headers=client_headers,
            json={
                "items": [
                    {
                        "irrigation_area_id": sample_irrigation_area.id,
                        "alert_type": "threshold",
                        "severity": "warning",
                        "channel": "email",
                        "enabled": False,
                    }
                ]
            },
        )
        assert upsert.status_code == 200
        data = upsert.json()
        assert data["created"] == 1
        assert data["updated"] == 0
        assert data["data"][0]["enabled"] is False

        listing = client.get(
            "/api/v1/notification-preferences?irrigation_area_id="
            f"{sample_irrigation_area.id}",
            headers=client_headers,
        )
        assert listing.status_code == 200
        payload = listing.json()
        assert payload["total"] == 1
        assert payload["data"][0]["channel"] == "email"
        assert payload["data"][0]["enabled"] is False

    def test_client_cannot_upsert_preferences_for_foreign_area(
        self,
        client,
        db,
        client_headers,
        sample_crop_type,
    ):
        foreign_area, _ = _create_foreign_area_node(db, sample_crop_type.id)

        resp = client.put(
            "/api/v1/notification-preferences/bulk",
            headers=client_headers,
            json={
                "items": [
                    {
                        "irrigation_area_id": foreign_area.id,
                        "alert_type": "threshold",
                        "severity": "critical",
                        "channel": "whatsapp",
                        "enabled": False,
                    }
                ]
            },
        )
        assert resp.status_code == 403

    def test_admin_can_list_preferences_but_cannot_bulk_upsert(
        self,
        client,
        admin_headers,
        client_headers,
        sample_irrigation_area,
    ):
        create_pref = client.put(
            "/api/v1/notification-preferences/bulk",
            headers=client_headers,
            json={
                "items": [
                    {
                        "irrigation_area_id": sample_irrigation_area.id,
                        "alert_type": "threshold",
                        "severity": "warning",
                        "channel": "email",
                        "enabled": False,
                    }
                ]
            },
        )
        assert create_pref.status_code == 200

        listing = client.get("/api/v1/notification-preferences", headers=admin_headers)
        assert listing.status_code == 200
        assert listing.json()["total"] >= 1

        forbidden = client.put(
            "/api/v1/notification-preferences/bulk",
            headers=admin_headers,
            json={"items": []},
        )
        assert forbidden.status_code == 403


class TestNotificationPreferencesDispatch:
    def _create_threshold(self, client, admin_headers, area_id, severity: str):
        resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": area_id,
                "parameter": "soil.humidity",
                "min_value": 50.0,
                "severity": severity,
            },
        )
        assert resp.status_code == 201

    def test_client_global_notifications_disabled_skips_dispatch(
        self,
        client,
        admin_headers,
        client_headers,
        node_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_EMAIL_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_WHATSAPP_ENABLED", True)

        calls = {"email": 0, "whatsapp": 0}

        def _fake_email(**_kwargs):
            calls["email"] += 1
            return True

        def _fake_whatsapp(**_kwargs):
            calls["whatsapp"] += 1
            return True

        monkeypatch.setattr(alert_service, "_send_email_notification", _fake_email)
        monkeypatch.setattr(
            alert_service, "_send_whatsapp_notification", _fake_whatsapp
        )

        toggle_resp = client.patch(
            "/api/v1/clients/me/notification-settings",
            headers=client_headers,
            json={"notifications_enabled": False},
        )
        assert toggle_resp.status_code == 200

        self._create_threshold(
            client, admin_headers, sample_irrigation_area.id, severity="warning"
        )

        ingest = client.post(
            "/api/v1/readings",
            headers=node_headers,
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-03T10:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 35.0,
                },
            },
        )
        assert ingest.status_code == 201

        dispatch = client.post(
            "/api/v1/alerts/dispatch-notifications?only_unread=true&limit=20",
            headers=admin_headers,
        )
        assert dispatch.status_code == 200
        data = dispatch.json()
        assert data["emailed_alerts"] == 0
        assert data["whatsapp_alerts"] == 0
        assert calls["email"] == 0
        assert calls["whatsapp"] == 0

    def test_preference_disabled_for_one_channel_still_dispatches_other_channel(
        self,
        client,
        admin_headers,
        client_headers,
        node_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_EMAIL_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_WHATSAPP_ENABLED", True)

        calls = {"email": 0, "whatsapp": 0}

        def _fake_email(**_kwargs):
            calls["email"] += 1
            return True

        def _fake_whatsapp(**_kwargs):
            calls["whatsapp"] += 1
            return True

        monkeypatch.setattr(alert_service, "_send_email_notification", _fake_email)
        monkeypatch.setattr(
            alert_service, "_send_whatsapp_notification", _fake_whatsapp
        )

        pref = client.put(
            "/api/v1/notification-preferences/bulk",
            headers=client_headers,
            json={
                "items": [
                    {
                        "irrigation_area_id": sample_irrigation_area.id,
                        "alert_type": "threshold",
                        "severity": "warning",
                        "channel": "email",
                        "enabled": False,
                    }
                ]
            },
        )
        assert pref.status_code == 200

        self._create_threshold(
            client, admin_headers, sample_irrigation_area.id, severity="warning"
        )

        ingest = client.post(
            "/api/v1/readings",
            headers=node_headers,
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-03T11:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 34.0,
                },
            },
        )
        assert ingest.status_code == 201

        dispatch = client.post(
            "/api/v1/alerts/dispatch-notifications?only_unread=true&limit=20",
            headers=admin_headers,
        )
        assert dispatch.status_code == 200
        data = dispatch.json()
        assert data["emailed_alerts"] == 0
        assert data["whatsapp_alerts"] == 1
        assert calls["email"] == 0
        assert calls["whatsapp"] == 1

    def test_default_preferences_dispatches_both_channels(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_EMAIL_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_WHATSAPP_ENABLED", True)

        calls = {"email": 0, "whatsapp": 0}

        def _fake_email(**_kwargs):
            calls["email"] += 1
            return True

        def _fake_whatsapp(**_kwargs):
            calls["whatsapp"] += 1
            return True

        monkeypatch.setattr(alert_service, "_send_email_notification", _fake_email)
        monkeypatch.setattr(
            alert_service, "_send_whatsapp_notification", _fake_whatsapp
        )

        self._create_threshold(
            client, admin_headers, sample_irrigation_area.id, severity="warning"
        )

        ingest = client.post(
            "/api/v1/readings",
            headers=node_headers,
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-03T12:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 33.0,
                },
            },
        )
        assert ingest.status_code == 201

        dispatch = client.post(
            "/api/v1/alerts/dispatch-notifications?only_unread=true&limit=20",
            headers=admin_headers,
        )
        assert dispatch.status_code == 200
        data = dispatch.json()
        assert data["emailed_alerts"] == 1
        assert data["whatsapp_alerts"] == 1
        assert calls["email"] == 1
        assert calls["whatsapp"] == 1
