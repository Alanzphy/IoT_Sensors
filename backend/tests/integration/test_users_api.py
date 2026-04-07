"""Tests de integración para /api/v1/users (solo admin)."""

import pytest


NEW_USER = {
    "email": "nuevo@test.com",
    "password": "pass123",
    "full_name": "Nuevo Usuario",
    "role": "cliente",
    "is_active": True,
}


class TestListUsers:
    def test_list_requires_admin(self, client, client_headers):
        resp = client.get("/api/v1/users", headers=client_headers)
        assert resp.status_code == 403

    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/users")
        assert resp.status_code == 401

    def test_list_success_admin(self, client, admin_headers, admin_user):
        resp = client.get("/api/v1/users", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert data["total"] >= 1

    def test_list_filter_by_role(self, client, admin_headers, admin_user, client_user):
        resp = client.get("/api/v1/users?role=admin", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert all(u["role"] == "admin" for u in data["data"])


class TestCreateUser:
    def test_create_user_admin(self, client, admin_headers):
        resp = client.post("/api/v1/users", json=NEW_USER, headers=admin_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "nuevo@test.com"
        assert data["role"] == "cliente"
        assert "id" in data

    def test_create_user_cliente_forbidden(self, client, client_headers):
        resp = client.post("/api/v1/users", json=NEW_USER, headers=client_headers)
        assert resp.status_code == 403

    def test_create_user_duplicate_email_returns_409(self, client, admin_headers, admin_user):
        resp = client.post(
            "/api/v1/users",
            json={**NEW_USER, "email": "admin@test.com"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    def test_create_user_invalid_role_returns_422(self, client, admin_headers):
        resp = client.post(
            "/api/v1/users",
            json={**NEW_USER, "role": "superadmin"},
            headers=admin_headers,
        )
        assert resp.status_code == 422


class TestGetUser:
    def test_get_user_admin(self, client, admin_headers, admin_user):
        resp = client.get(f"/api/v1/users/{admin_user.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin@test.com"

    def test_get_nonexistent_user_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/users/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateUser:
    def test_update_user_full_name(self, client, admin_headers, admin_user):
        resp = client.put(
            f"/api/v1/users/{admin_user.id}",
            json={"full_name": "Admin Actualizado"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Admin Actualizado"

    def test_update_nonexistent_returns_404(self, client, admin_headers):
        resp = client.put(
            "/api/v1/users/99999",
            json={"full_name": "X"},
            headers=admin_headers,
        )
        assert resp.status_code == 404


class TestDeleteUser:
    def test_delete_user(self, client, admin_headers):
        # Crear un usuario primero
        created = client.post(
            "/api/v1/users",
            json={**NEW_USER, "email": "del_user@test.com"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/users/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200
        # Ya no debe estar disponible
        resp2 = client.get(f"/api/v1/users/{created['id']}", headers=admin_headers)
        assert resp2.status_code == 404
