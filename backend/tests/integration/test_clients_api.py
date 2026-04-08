"""Tests de integración para /api/v1/clients."""

import pytest


NEW_CLIENT = {
    "email": "cli_api@test.com",
    "password": "pass123",
    "full_name": "Cliente API",
    "company_name": "Empresa API SA",
    "phone": "555-8888",
    "address": "Av. Prueba 1",
}


class TestListClients:
    def test_list_requires_admin(self, client, client_headers):
        resp = client.get("/api/v1/clients", headers=client_headers)
        assert resp.status_code == 403

    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/clients")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, client_user):
        resp = client.get("/api/v1/clients", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert data["total"] >= 1


class TestCreateClient:
    def test_create_client_success(self, client, admin_headers):
        resp = client.post("/api/v1/clients", json=NEW_CLIENT, headers=admin_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["company_name"] == "Empresa API SA"
        assert "id" in data
        assert data["user"]["role"] == "cliente"

    def test_create_client_unauthenticated_returns_401(self, client):
        resp = client.post("/api/v1/clients", json=NEW_CLIENT)
        assert resp.status_code == 401

    def test_create_client_duplicate_email_returns_409(self, client, admin_headers, client_user):
        resp = client.post(
            "/api/v1/clients",
            json={**NEW_CLIENT, "email": "cliente@test.com"},
            headers=admin_headers,
        )
        assert resp.status_code == 409


class TestGetClient:
    def test_get_client_success(self, client, admin_headers, client_user):
        _, client_record = client_user
        resp = client.get(f"/api/v1/clients/{client_record.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == client_record.id

    def test_get_nonexistent_client_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/clients/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateClient:
    def test_update_company_name(self, client, admin_headers, client_user):
        _, client_record = client_user
        resp = client.put(
            f"/api/v1/clients/{client_record.id}",
            json={"company_name": "Nueva Empresa"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["company_name"] == "Nueva Empresa"


class TestDeleteClient:
    def test_delete_client(self, client, admin_headers):
        created = client.post(
            "/api/v1/clients",
            json={**NEW_CLIENT, "email": "del_cli@test.com"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/clients/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200
        # No debería aparecer en la lista
        list_resp = client.get("/api/v1/clients", headers=admin_headers)
        ids = [c["id"] for c in list_resp.json()["data"]]
        assert created["id"] not in ids
