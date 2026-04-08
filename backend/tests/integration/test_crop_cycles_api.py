"""Tests de integración para /api/v1/crop-cycles."""

import pytest


class TestListCropCycles:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/crop-cycles")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, sample_crop_cycle):
        resp = client.get("/api/v1/crop-cycles", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_list_filter_by_irrigation_area(self, client, admin_headers, sample_crop_cycle, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/crop-cycles?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert all(c["irrigation_area_id"] == sample_irrigation_area.id for c in data["data"])


class TestCreateCropCycle:
    def test_create_active_cycle_success(self, client, admin_headers, sample_irrigation_area):
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-01-01"},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["start_date"] == "2026-01-01"
        assert data["end_date"] is None

    def test_create_second_active_cycle_returns_409(self, client, admin_headers, sample_irrigation_area):
        client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-01-01"},
            headers=admin_headers,
        )
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-06-01"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    def test_create_invalid_area_returns_404(self, client, admin_headers):
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": 99999, "start_date": "2026-01-01"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_requires_admin(self, client, client_headers, sample_irrigation_area):
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-01-01"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestGetCropCycle:
    def test_get_success(self, client, admin_headers, sample_crop_cycle):
        resp = client.get(f"/api/v1/crop-cycles/{sample_crop_cycle.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_crop_cycle.id

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/crop-cycles/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateCropCycle:
    def test_close_cycle(self, client, admin_headers, sample_crop_cycle):
        resp = client.put(
            f"/api/v1/crop-cycles/{sample_crop_cycle.id}",
            json={"end_date": "2026-06-30"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["end_date"] == "2026-06-30"


class TestDeleteCropCycle:
    def test_delete_cycle(self, client, admin_headers, sample_irrigation_area):
        created = client.post(
            "/api/v1/crop-cycles",
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "start_date": "2025-01-01",
                "end_date": "2025-12-31",
            },
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/crop-cycles/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/crop-cycles/{created['id']}", headers=admin_headers)
        assert resp2.status_code == 404
