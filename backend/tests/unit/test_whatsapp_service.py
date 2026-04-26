import json
from datetime import datetime
from decimal import Decimal
from urllib import parse

from app.core.config import settings
from app.models.alert import Alert
from app.services.whatsapp import (
    WhatsAppAlertContext,
    send_whatsapp_alert,
    send_whatsapp_text_message,
)


class _FakeResponse:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def _context() -> WhatsAppAlertContext:
    return WhatsAppAlertContext(
        alert=Alert(
            id=123,
            nodo_id=7,
            area_riego_id=5,
            tipo="threshold",
            parametro="soil.humidity",
            valor_detectado=Decimal("14.5"),
            severidad="critical",
            mensaje="soil.humidity fuera de umbral (14.5)",
            marca_tiempo=datetime(2026, 4, 24, 3, 20),
        ),
        recipient_phone="+52 614 123 4567",
        property_name="Rancho Test",
        area_name="Nogal Norte",
        node_name="Nodo 7",
        recommendation_url="https://demo.example.com/cliente/alertas/123",
        message="Alerta de monitoreo de riego\nSeveridad: CRITICAL",
    )


def test_meta_provider_sends_template_payload(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "meta")
    monkeypatch.setattr(settings, "WHATSAPP_MESSAGE_MODE", "template")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "token")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_NAME", "alerta_riego_critica_v1")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE_CODE", "es_MX")

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["timeout"] = timeout
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["authorization"] = req.headers["Authorization"]
        return _FakeResponse()

    monkeypatch.setattr("app.services.whatsapp.request.urlopen", fake_urlopen)

    assert send_whatsapp_alert(_context()) is True
    assert captured["url"].endswith("/123456/messages")
    assert captured["authorization"] == "Bearer token"
    body = captured["body"]
    assert body["type"] == "template"
    assert body["to"] == "526141234567"
    assert body["template"]["name"] == "alerta_riego_critica_v1"
    params = body["template"]["components"][0]["parameters"]
    assert [item["text"] for item in params] == [
        "Nogal Norte",
        "Nodo 7",
        "soil.humidity",
        "14.5",
        "2026-04-24 03:20 UTC",
        "https://demo.example.com/cliente/alertas/123",
    ]


def test_twilio_provider_sends_content_template(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "twilio")
    monkeypatch.setattr(settings, "WHATSAPP_MESSAGE_MODE", "template")
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setattr(settings, "TWILIO_WHATSAPP_FROM", "+15551234567")
    monkeypatch.setattr(settings, "TWILIO_MESSAGING_SERVICE_SID", "")
    monkeypatch.setattr(settings, "TWILIO_CONTENT_SID", "HX123")

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["timeout"] = timeout
        captured["body"] = parse.parse_qs(req.data.decode("utf-8"))
        captured["authorization"] = req.headers["Authorization"]
        return _FakeResponse()

    monkeypatch.setattr("app.services.whatsapp.request.urlopen", fake_urlopen)

    assert send_whatsapp_alert(_context()) is True
    assert captured["url"].endswith("/Accounts/AC123/Messages.json")
    assert captured["authorization"].startswith("Basic ")
    body = captured["body"]
    assert body["To"] == ["whatsapp:+526141234567"]
    assert body["From"] == ["whatsapp:+15551234567"]
    assert body["ContentSid"] == ["HX123"]
    variables = json.loads(body["ContentVariables"][0])
    assert variables["1"] == "Nogal Norte"
    assert variables["6"] == "https://demo.example.com/cliente/alertas/123"


def test_meta_provider_sends_text_payload(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "meta")
    monkeypatch.setattr(settings, "WHATSAPP_MESSAGE_MODE", "text")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "token")

    def fake_urlopen(req, timeout):
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["authorization"] = req.headers["Authorization"]
        return _FakeResponse()

    monkeypatch.setattr("app.services.whatsapp.request.urlopen", fake_urlopen)

    assert send_whatsapp_alert(_context()) is True
    body = captured["body"]
    assert body["type"] == "text"
    assert body["text"]["preview_url"] is False
    assert "Alerta de monitoreo de riego" in body["text"]["body"]
    assert "https://demo.example.com/cliente/alertas/123" in body["text"]["body"]


def test_twilio_provider_sends_text_body(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "twilio")
    monkeypatch.setattr(settings, "WHATSAPP_MESSAGE_MODE", "text")
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setattr(settings, "TWILIO_WHATSAPP_FROM", "+15551234567")
    monkeypatch.setattr(settings, "TWILIO_MESSAGING_SERVICE_SID", "")

    def fake_urlopen(req, timeout):
        captured["body"] = parse.parse_qs(req.data.decode("utf-8"))
        captured["authorization"] = req.headers["Authorization"]
        return _FakeResponse()

    monkeypatch.setattr("app.services.whatsapp.request.urlopen", fake_urlopen)

    assert send_whatsapp_alert(_context()) is True
    body = captured["body"]
    assert body["To"] == ["whatsapp:+526141234567"]
    assert body["From"] == ["whatsapp:+15551234567"]
    assert "ContentSid" not in body
    assert "Alerta de monitoreo de riego" in body["Body"][0]
    assert "https://demo.example.com/cliente/alertas/123" in body["Body"][0]


def test_send_whatsapp_text_message_meta(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "meta")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "token")

    def fake_urlopen(req, timeout):
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["authorization"] = req.headers["Authorization"]
        return _FakeResponse()

    monkeypatch.setattr("app.services.whatsapp.request.urlopen", fake_urlopen)

    assert (
        send_whatsapp_text_message(
            recipient_phone="+52 614 123 4567",
            message="Reporte IA listo",
        )
        is True
    )
    body = captured["body"]
    assert body["type"] == "text"
    assert body["to"] == "526141234567"
    assert body["text"]["body"] == "Reporte IA listo"


def test_send_whatsapp_text_message_twilio(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "twilio")
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setattr(settings, "TWILIO_WHATSAPP_FROM", "+15551234567")
    monkeypatch.setattr(settings, "TWILIO_MESSAGING_SERVICE_SID", "")

    def fake_urlopen(req, timeout):
        captured["body"] = parse.parse_qs(req.data.decode("utf-8"))
        captured["authorization"] = req.headers["Authorization"]
        return _FakeResponse()

    monkeypatch.setattr("app.services.whatsapp.request.urlopen", fake_urlopen)

    assert (
        send_whatsapp_text_message(
            recipient_phone="+52 614 123 4567",
            message="Reporte IA listo",
        )
        is True
    )
    body = captured["body"]
    assert body["To"] == ["whatsapp:+526141234567"]
    assert body["From"] == ["whatsapp:+15551234567"]
    assert body["Body"] == ["Reporte IA listo"]
