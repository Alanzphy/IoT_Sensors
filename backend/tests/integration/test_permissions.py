"""Tests de integración: aislamiento de permisos entre roles.

Verifica que los clientes solo pueden ver sus propios datos
y que el admin puede ver todo.
"""

import pytest


SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T12:00:00Z",
    "soil": {"conductivity": 1.0, "temperature": 20.0, "humidity": 30.0, "water_potential": -0.5},
    "irrigation": {"active": False, "accumulated_liters": 500.0, "flow_per_minute": 5.0},
    "environmental": {"temperature": 25.0, "relative_humidity": 60.0, "wind_speed": 10.0, "solar_radiation": 400.0, "eto": 3.5},
}


class TestClientCanOnlySeeOwnData:
    def test_client_can_list_own_readings(
        self, client, client_headers, node_headers, sample_node, sample_irrigation_area
    ):
        """El cliente puede ver lecturas de su propio área de riego."""
        client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=node_headers)
        resp = client.get(
            f"/api/v1/readings?irrigation_area_id={sample_irrigation_area.id}",
            headers=client_headers,
        )
        assert resp.status_code == 200

    def test_client_can_get_latest_reading_of_own_area(
        self, client, client_headers, node_headers, sample_node, sample_irrigation_area
    ):
        client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=node_headers)
        resp = client.get(
            f"/api/v1/readings/latest?irrigation_area_id={sample_irrigation_area.id}",
            headers=client_headers,
        )
        assert resp.status_code == 200

    def test_client_cannot_see_readings_of_another_client(
        self,
        client,
        client_headers,
        node_headers,
        sample_node,
        admin_headers,
        sample_crop_type,
    ):
        """Crear un área+nodo de un cliente diferente y verificar 403."""
        # Crear cliente distinto
        other_client_resp = client.post(
            "/api/v1/clients",
            json={
                "email": "otro@test.com",
                "password": "pass123",
                "full_name": "Otro Cliente",
                "company_name": "Otra Empresa",
            },
            headers=admin_headers,
        ).json()

        other_prop = client.post(
            "/api/v1/properties",
            json={"client_id": other_client_resp["id"], "name": "Rancho Otro"},
            headers=admin_headers,
        ).json()

        other_area = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": other_prop["id"],
                "crop_type_id": sample_crop_type.id,
                "name": "Área Otro Cliente",
            },
            headers=admin_headers,
        ).json()

        # El primer cliente intenta acceder al área del segundo → 403
        resp = client.get(
            f"/api/v1/readings?irrigation_area_id={other_area['id']}",
            headers=client_headers,
        )
        assert resp.status_code == 403

    def test_client_cannot_access_admin_only_endpoints(self, client, client_headers):
        """Un usuario cliente no puede acceder a endpoints solo de admin."""
        resp = client.get("/api/v1/users", headers=client_headers)
        assert resp.status_code == 403

        resp = client.post(
            "/api/v1/clients",
            json={"email": "x@x.com", "password": "p", "full_name": "X", "company_name": "X"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestAdminCanSeeAll:
    def test_admin_can_see_all_clients(self, client, admin_headers, client_user):
        resp = client.get("/api/v1/clients", headers=admin_headers)
        assert resp.status_code == 200

    def test_admin_can_see_all_usuarios(self, client, admin_headers, client_user):
        resp = client.get("/api/v1/users", headers=admin_headers)
        assert resp.status_code == 200

    def test_admin_can_see_readings_of_any_area(
        self, client, admin_headers, node_headers, sample_node, sample_irrigation_area
    ):
        client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=node_headers)
        resp = client.get(
            f"/api/v1/readings?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200

    def test_admin_can_create_everything(
        self, client, admin_headers, sample_property, sample_crop_type
    ):
        """Admin puede crear áreas de riego sin restricción."""
        resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": sample_property.id,
                "crop_type_id": sample_crop_type.id,
                "name": "Admin Created Area",
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201


class TestUnauthenticatedAccess:
    def test_unauthenticated_cannot_list_readings(self, client):
        resp = client.get("/api/v1/readings")
        assert resp.status_code == 401

    def test_unauthenticated_cannot_list_clients(self, client):
        resp = client.get("/api/v1/clients")
        assert resp.status_code == 401

    def test_health_endpoint_is_public(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
