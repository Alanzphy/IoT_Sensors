"""Tests unitarios para app.core.config (guard de SECRET_KEY)."""

import pytest

from app.core.config import INSECURE_DEFAULT_SECRET_KEYS, Settings


class TestSecretKeyGuard:
    def test_default_secret_key_raises_outside_debug(self):
        with pytest.raises(ValueError):
            Settings(DEBUG=False, SECRET_KEY="CHANGE-ME-in-production")

    def test_dev_default_secret_key_raises_outside_debug(self):
        with pytest.raises(ValueError):
            Settings(
                DEBUG=False,
                SECRET_KEY="dev-only-change-me-in-production-abc123xyz",
            )

    def test_custom_secret_key_allowed_outside_debug(self):
        settings = Settings(DEBUG=False, SECRET_KEY="strong-production-secret-42")
        assert settings.SECRET_KEY == "strong-production-secret-42"

    def test_default_secret_key_allowed_in_debug(self):
        settings = Settings(DEBUG=True, SECRET_KEY="CHANGE-ME-in-production")
        assert settings.DEBUG is True

    def test_known_insecure_defaults_are_registered(self):
        assert "CHANGE-ME-in-production" in INSECURE_DEFAULT_SECRET_KEYS
        assert (
            "dev-only-change-me-in-production-abc123xyz"
            in INSECURE_DEFAULT_SECRET_KEYS
        )