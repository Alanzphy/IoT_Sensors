"""Tests de integración para /api/v1/auth (login, refresh, logout)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

from app.models.audit_log import AuditLog
from app.models.password_reset_token import PasswordResetToken
from app.services import password_reset as password_reset_service


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
        client.post(
            "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
        )
        resp = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 404

    def test_revoked_token_cannot_be_refreshed(self, client, admin_user):
        tokens = client.post("/api/v1/auth/login", json=VALID_ADMIN).json()
        client.post(
            "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
        )
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 401


class TestPasswordRecovery:
    @staticmethod
    def _clear_recovery_audit(db) -> None:
        db.execute(
            delete(AuditLog).where(
                AuditLog.entidad.in_(
                    [
                        "password_reset_forgot_email",
                        "password_reset_forgot_ip",
                        "password_reset_confirm_ip",
                        "password_recovery",
                    ]
                )
            )
        )
        db.commit()

    def test_forgot_password_existing_user_creates_reset_token(
        self,
        client,
        admin_user,
        db,
        monkeypatch,
    ):
        self._clear_recovery_audit(db)
        raw_token = "tok_" + "a" * 44
        monkeypatch.setattr(
            password_reset_service, "_generate_raw_reset_token", lambda: raw_token
        )
        monkeypatch.setattr(
            password_reset_service, "_send_reset_email", lambda **kwargs: True
        )

        resp = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"},
        )
        assert resp.status_code == 200

        token_hash = password_reset_service._hash_reset_token(raw_token)
        db_token = db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash
            )
        ).scalar_one_or_none()
        assert db_token is not None
        assert db_token.usuario_id == admin_user.id

    def test_forgot_password_nonexistent_email_returns_generic_message(
        self,
        client,
        db,
        monkeypatch,
    ):
        self._clear_recovery_audit(db)
        monkeypatch.setattr(
            password_reset_service, "_send_reset_email", lambda **kwargs: True
        )
        resp = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nadie@test.com"},
        )
        assert resp.status_code == 200

        tokens = db.execute(select(PasswordResetToken)).scalars().all()
        assert len(tokens) == 0

    def test_forgot_password_rate_limited_by_email_blocks_new_issue(
        self,
        client,
        admin_user,
        db,
        monkeypatch,
    ):
        self._clear_recovery_audit(db)
        calls = {"count": 0}

        def _token_factory() -> str:
            calls["count"] += 1
            return "tok_" + f"{calls['count']:044d}"

        monkeypatch.setattr(password_reset_service, "_generate_raw_reset_token", _token_factory)
        monkeypatch.setattr(
            password_reset_service, "_send_reset_email", lambda **kwargs: True
        )
        monkeypatch.setattr(
            password_reset_service.settings,
            "PASSWORD_RESET_REQUEST_MAX_PER_EMAIL",
            1,
        )
        monkeypatch.setattr(
            password_reset_service.settings,
            "PASSWORD_RESET_REQUEST_MAX_PER_IP",
            100,
        )

        first = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"},
        )
        second = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"},
        )

        assert first.status_code == 200
        assert second.status_code == 200
        assert calls["count"] == 1

    def test_reset_password_invalid_token_returns_400(self, client):
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "tok_" + "z" * 44, "new_password": "nuevaClave123"},
        )
        assert resp.status_code == 400

    def test_reset_password_expired_token_returns_400(
        self,
        client,
        admin_user,
        db,
        monkeypatch,
    ):
        self._clear_recovery_audit(db)
        raw_token = "tok_" + "c" * 44
        monkeypatch.setattr(
            password_reset_service, "_generate_raw_reset_token", lambda: raw_token
        )
        monkeypatch.setattr(
            password_reset_service, "_send_reset_email", lambda **kwargs: True
        )

        forgot = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"},
        )
        assert forgot.status_code == 200

        token_hash = password_reset_service._hash_reset_token(raw_token)
        token = db.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        ).scalar_one()
        token.expira_en = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
        db.commit()

        reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": raw_token, "new_password": "nuevaClave123"},
        )
        assert reset.status_code == 400

    def test_reset_password_reused_token_returns_400(
        self,
        client,
        admin_user,
        db,
        monkeypatch,
    ):
        self._clear_recovery_audit(db)
        raw_token = "tok_" + "d" * 44
        monkeypatch.setattr(
            password_reset_service, "_generate_raw_reset_token", lambda: raw_token
        )
        monkeypatch.setattr(
            password_reset_service, "_send_reset_email", lambda **kwargs: True
        )

        forgot = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"},
        )
        assert forgot.status_code == 200

        first_reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": raw_token, "new_password": "nuevaClave123"},
        )
        assert first_reset.status_code == 200

        second_reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": raw_token, "new_password": "nuevaClave456"},
        )
        assert second_reset.status_code == 400

    def test_reset_password_rate_limited_by_ip_returns_429(
        self,
        client,
        db,
        monkeypatch,
    ):
        self._clear_recovery_audit(db)
        monkeypatch.setattr(
            password_reset_service.settings,
            "PASSWORD_RESET_CONFIRM_MAX_PER_IP",
            1,
        )

        first = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "tok_" + "q" * 44, "new_password": "nuevaClave123"},
        )
        assert first.status_code == 400

        second = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "tok_" + "w" * 44, "new_password": "nuevaClave123"},
        )
        assert second.status_code == 429

    def test_reset_password_success_and_revokes_existing_refresh_tokens(
        self,
        client,
        admin_user,
        monkeypatch,
    ):
        existing_tokens = client.post("/api/v1/auth/login", json=VALID_ADMIN).json()

        raw_token = "tok_" + "b" * 44
        monkeypatch.setattr(
            password_reset_service, "_generate_raw_reset_token", lambda: raw_token
        )
        monkeypatch.setattr(
            password_reset_service, "_send_reset_email", lambda **kwargs: True
        )

        forgot = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"},
        )
        assert forgot.status_code == 200

        reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": raw_token, "new_password": "nuevaClave123"},
        )
        assert reset.status_code == 200

        old_login = client.post("/api/v1/auth/login", json=VALID_ADMIN)
        assert old_login.status_code == 401

        refresh_after_reset = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": existing_tokens["refresh_token"]},
        )
        assert refresh_after_reset.status_code == 401

        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "nuevaClave123"},
        )
        assert new_login.status_code == 200
