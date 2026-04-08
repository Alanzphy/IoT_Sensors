"""Tests de integración para /api/v1/irrigation-areas."""

import pytest


class TestListIrrigationAreas:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/irrigation-areas")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, sample_irrigation_area):
        resp = client.get("/api/v1/irrigation-areas", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_list_filter_by_property(self, client, admin_headers, sample_property, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/irrigation-areas?property_id={sample_property.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert all(a["property_id"] == sample_property.id for a in data["data"])


class TestCreateIrrigationArea:
    def test_create_success(self, client, admin_headers, sample_property, sample_crop_type):
        resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": sample_property.id,
                "crop_type_id": sample_crop_type.id,
                "name": "Área API Test",
                "area_size": 20.0,
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Área API Test"
        assert data["property_id"] == sample_property.id

    def test_create_invalid_property_returns_404(self, client, admin_headers, sample_crop_type):
        resp = client.post(
            "/api/v1/irrigation-areas",
            json={"property_id": 99999, "crop_type_id": sample_crop_type.id, "name": "Bad"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_invalid_crop_type_returns_404(self, client, admin_headers, sample_property):
        resp = client.post(
            "/api/v1/irrigation-areas",
            json={"property_id": sample_property.id, "crop_type_id": 99999, "name": "Bad"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_requires_admin(self, client, client_headers, sample_property, sample_crop_type):
        resp = client.post(
            "/api/v1/irrigation-areas",
            json={"property_id": sample_property.id, "crop_type_id": sample_crop_type.id, "name": "X"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestGetIrrigationArea:
    def test_get_success(self, client, admin_headers, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/irrigation-areas/{sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_irrigation_area.id

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/irrigation-areas/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateIrrigationArea:
    def test_update_name(self, client, admin_headers, sample_irrigation_area):
        resp = client.put(
            f"/api/v1/irrigation-areas/{sample_irrigation_area.id}",
            json={"name": "Área Actualizada"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Área Actualizada"


class TestDeleteIrrigationArea:
    def test_delete_area(self, client, admin_headers, sample_property, sample_crop_type):
        created = client.post(
            "/api/v1/irrigation-areas",
            json={"property_id": sample_property.id, "crop_type_id": sample_crop_type.id, "name": "Para Borrar"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/irrigation-areas/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/irrigation-areas/{created['id']}", headers=admin_headers)
        assert resp2.status_code == 404
