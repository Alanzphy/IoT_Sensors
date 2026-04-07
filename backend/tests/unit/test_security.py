"""Tests unitarios para app.core.security."""

import time

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_is_different_from_plain(self):
        plain = "mySecret123"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_verify_correct_password(self):
        plain = "mySecret123"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_same_plain_generates_different_hashes(self):
        """bcrypt usa salt aleatorio: dos hashes del mismo texto difieren."""
        plain = "samePassword"
        h1 = hash_password(plain)
        h2 = hash_password(plain)
        assert h1 != h2
        assert verify_password(plain, h1)
        assert verify_password(plain, h2)


class TestJWTTokens:
    def _base_data(self):
        return {"sub": "42", "rol": "admin", "nombre": "Test Admin"}

    def test_access_token_contains_correct_type(self):
        token = create_access_token(self._base_data())
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "access"

    def test_refresh_token_contains_correct_type(self):
        token = create_refresh_token(self._base_data())
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_decode_returns_original_claims(self):
        data = self._base_data()
        token = create_access_token(data)
        payload = decode_token(token)
        assert payload["sub"] == "42"
        assert payload["rol"] == "admin"
        assert payload["nombre"] == "Test Admin"

    def test_decode_invalid_token_returns_none(self):
        result = decode_token("this.is.not.valid")
        assert result is None

    def test_decode_tampered_token_returns_none(self):
        token = create_access_token(self._base_data())
        tampered = token[:-4] + "XXXX"
        result = decode_token(tampered)
        assert result is None

    def test_decode_expired_token_returns_none(self):
        """Crear un token ya expirado (exp en el pasado)."""
        from datetime import datetime, timedelta, timezone

        data = self._base_data()
        data["exp"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        data["type"] = "access"
        expired_token = jwt.encode(
            data, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )
        result = decode_token(expired_token)
        assert result is None

    def test_access_token_has_expiry(self):
        token = create_access_token(self._base_data())
        payload = decode_token(token)
        assert "exp" in payload

    def test_refresh_token_expires_later_than_access(self):
        data = self._base_data()
        access = create_access_token(data)
        refresh = create_refresh_token(data)
        access_exp = decode_token(access)["exp"]
        refresh_exp = decode_token(refresh)["exp"]
        assert refresh_exp > access_exp
