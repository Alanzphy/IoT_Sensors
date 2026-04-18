"""Tests de integración: aislamiento de permisos entre roles.

Verifica que los clientes solo pueden ver sus propios datos
y que el admin puede ver todo.
"""

import pytest


SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T12:00:00Z",
    "soil": {
        "conductivity": 1.0,
        "temperature": 20.0,
        "humidity": 30.0,
        "water_potential": -0.5,
    },
    "irrigation": {
        "active": False,
        "accumulated_liters": 500.0,
        "flow_per_minute": 5.0,
    },
    "environmental": {
        "temperature": 25.0,
        "relative_humidity": 60.0,
        "wind_speed": 10.0,
        "solar_radiation": 400.0,
        "eto": 3.5,
    },
}


class TestClientCanOnlySeeOwnData:
    def _create_other_client_area_and_node(
        self,
        client,
        admin_headers,
        sample_crop_type,
    ):
        other_client_resp = client.post(
            "/api/v1/clients",
            json={
                "email": "otro@test.com",
                "password": "pass123",
                "full_name": "Otro Cliente",
                "company_name": "Otra Empresa",
            },
            headers=admin_headers,
        )
        assert other_client_resp.status_code == 201
        other_client_id = other_client_resp.json()["id"]

        other_prop_resp = client.post(
            "/api/v1/properties",
            json={"client_id": other_client_id, "name": "Rancho Otro"},
            headers=admin_headers,
        )
        assert other_prop_resp.status_code == 201
        other_prop_id = other_prop_resp.json()["id"]

        other_area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": other_prop_id,
                "crop_type_id": sample_crop_type.id,
                "name": "Area Otro Cliente",
            },
            headers=admin_headers,
        )
        assert other_area_resp.status_code == 201
        other_area_id = other_area_resp.json()["id"]

        other_node_resp = client.post(
            "/api/v1/nodes",
            json={
                "irrigation_area_id": other_area_id,
                "name": "Nodo Otro Cliente",
                "latitude": 29.0,
                "longitude": -107.0,
            },
            headers=admin_headers,
        )
        assert other_node_resp.status_code == 201

        return other_area_id, other_node_resp.json()["api_key"]

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

    def test_client_can_get_priority_status_of_own_area(
        self, client, client_headers, sample_irrigation_area, sample_node
    ):
        resp = client.get(
            f"/api/v1/readings/priority-status?irrigation_area_id={sample_irrigation_area.id}",
            headers=client_headers,
        )
        assert resp.status_code == 200

    def test_client_cannot_see_readings_of_another_client(
        self,
        client,
        client_headers,
        admin_headers,
        sample_crop_type,
    ):
        """Crear un área+nodo de un cliente diferente y verificar 403."""
        other_area_id, _ = self._create_other_client_area_and_node(
            client,
            admin_headers,
            sample_crop_type,
        )

        # El primer cliente intenta acceder al área del segundo → 403
        resp = client.get(
            f"/api/v1/readings?irrigation_area_id={other_area_id}",
            headers=client_headers,
        )
        assert resp.status_code == 403

    def test_client_list_without_area_is_scoped_to_own_data(
        self,
        client,
        client_headers,
        node_headers,
        sample_node,
        admin_headers,
        sample_crop_type,
    ):
        # lectura del cliente dueño
        own_ingest = client.post(
            "/api/v1/readings",
            json={**SENSOR_PAYLOAD, "timestamp": "2026-04-01T12:00:00Z"},
            headers=node_headers,
        )
        assert own_ingest.status_code == 201

        # lectura de otro cliente
        _, other_api_key = self._create_other_client_area_and_node(
            client,
            admin_headers,
            sample_crop_type,
        )
        other_ingest = client.post(
            "/api/v1/readings",
            json={**SENSOR_PAYLOAD, "timestamp": "2026-04-01T13:00:00Z"},
            headers={"X-API-Key": other_api_key},
        )
        assert other_ingest.status_code == 201

        resp = client.get("/api/v1/readings", headers=client_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["data"]) == 1
        assert data["data"][0]["node_id"] == sample_node.id

    def test_client_cannot_get_latest_or_export_for_foreign_area(
        self,
        client,
        client_headers,
        admin_headers,
        sample_crop_type,
    ):
        other_area_id, _ = self._create_other_client_area_and_node(
            client,
            admin_headers,
            sample_crop_type,
        )

        latest_resp = client.get(
            f"/api/v1/readings/latest?irrigation_area_id={other_area_id}",
            headers=client_headers,
        )
        assert latest_resp.status_code == 403

        export_resp = client.get(
            f"/api/v1/readings/export?format=csv&irrigation_area_id={other_area_id}",
            headers=client_headers,
        )
        assert export_resp.status_code == 403

        priority_resp = client.get(
            f"/api/v1/readings/priority-status?irrigation_area_id={other_area_id}",
            headers=client_headers,
        )
        assert priority_resp.status_code == 403

    def test_client_cannot_access_admin_only_endpoints(self, client, client_headers):
        """Un usuario cliente no puede acceder a endpoints solo de admin."""
        resp = client.get("/api/v1/users", headers=client_headers)
        assert resp.status_code == 403

        resp = client.post(
            "/api/v1/clients",
            json={
                "email": "x@x.com",
                "password": "p",
                "full_name": "X",
                "company_name": "X",
            },
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
