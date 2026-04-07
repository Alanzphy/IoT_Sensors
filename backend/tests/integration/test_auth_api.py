"""Tests de integración para /api/v1/auth (login, refresh, logout)."""

import pytest


VALID_ADMIN = {"email": "admin@test.com", "password": "adminpass"}
VALID_CLIENTE = {"email": "cliente@test.com", "password": "clientepass"}


class TestLogin:
    def test_login_admin_success(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json=VALID_ADMIN)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_cliente_success(self, client, client_user):
        resp = client.post("/api/v1/auth/login", json=VALID_CLIENTE)
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password_returns_401(self, client, admin_user):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "WRONG"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@test.com", "password": "whatever"},
        )
        assert resp.status_code == 401

    def test_login_missing_fields_returns_422(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "admin@test.com"})
        assert resp.status_code == 422


class TestRefreshToken:
    def _get_tokens(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json=VALID_ADMIN)
        return resp.json()

    def test_refresh_returns_new_access_token(self, client, admin_user):
        tokens = self._get_tokens(client, admin_user)
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_refresh_with_invalid_token_returns_401(self, client):
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert resp.status_code == 401

    def test_refresh_with_access_token_as_refresh_returns_401(self, client, admin_user):
        """No acepta un access token donde se espera un refresh token."""
        tokens = self._get_tokens(client, admin_user)
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["access_token"]},
        )
        assert resp.status_code == 401


class TestLogout:
    def test_logout_success(self, client, admin_user):
        tokens = client.post("/api/v1/auth/login", json=VALID_ADMIN).json()
        resp = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "detail" in data

    def test_logout_same_token_twice_returns_404(self, client, admin_user):
        tokens = client.post("/api/v1/auth/login", json=VALID_ADMIN).json()
        client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
        resp = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 404

    def test_revoked_token_cannot_be_refreshed(self, client, admin_user):
        tokens = client.post("/api/v1/auth/login", json=VALID_ADMIN).json()
        client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 401
