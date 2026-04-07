"""Tests de integración para /api/v1/nodes."""

import pytest


class TestListNodes:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/nodes")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, sample_node):
        resp = client.get("/api/v1/nodes", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    def test_list_filter_by_irrigation_area(self, client, admin_headers, sample_node, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/nodes?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["data"][0]["irrigation_area_id"] == sample_irrigation_area.id


class TestCreateNode:
    def test_create_success(self, client, admin_headers, sample_property, sample_crop_type):
        # Crear área de riego separada para este test (via API)
        area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": sample_property.id,
                "crop_type_id": sample_crop_type.id,
                "name": "Área Para Nodo",
            },
            headers=admin_headers,
        )
        area_id = area_resp.json()["id"]
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": area_id, "name": "Nodo API", "latitude": 28.5, "longitude": -106.0},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Nodo API"
        assert "api_key" in data
        assert data["api_key"].startswith("ak_")

    def test_create_second_node_same_area_returns_409(self, client, admin_headers, sample_irrigation_area, sample_node):
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": sample_irrigation_area.id, "name": "Duplicado"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    def test_create_invalid_area_returns_404(self, client, admin_headers):
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": 99999, "name": "Bad Node"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_requires_admin(self, client, client_headers, sample_irrigation_area):
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": sample_irrigation_area.id, "name": "No Perm"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestGetNode:
    def test_get_success(self, client, admin_headers, sample_node):
        resp = client.get(f"/api/v1/nodes/{sample_node.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_node.id

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/nodes/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateNode:
    def test_update_name(self, client, admin_headers, sample_node):
        resp = client.put(
            f"/api/v1/nodes/{sample_node.id}",
            json={"name": "Nodo Actualizado"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Nodo Actualizado"

    def test_deactivate_node(self, client, admin_headers, sample_node):
        resp = client.put(
            f"/api/v1/nodes/{sample_node.id}",
            json={"is_active": False},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False


class TestDeleteNode:
    def test_delete_node(self, client, admin_headers, sample_property, sample_crop_type):
        area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={"property_id": sample_property.id, "crop_type_id": sample_crop_type.id, "name": "Área Temp"},
            headers=admin_headers,
        )
        area_id = area_resp.json()["id"]
        node_resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": area_id, "name": "Nodo Temp"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/nodes/{node_resp['id']}", headers=admin_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/nodes/{node_resp['id']}", headers=admin_headers)
        assert resp2.status_code == 404
