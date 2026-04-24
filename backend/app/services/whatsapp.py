import base64
import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from urllib import error, parse, request

from app.core.config import settings
from app.models.alert import Alert


@dataclass(frozen=True)
class WhatsAppAlertContext:
    alert: Alert
    recipient_phone: str
    property_name: str
    area_name: str
    node_name: str
    recommendation_url: str
    message: str


def _clean_phone(raw_phone: str) -> str:
    return "".join(ch for ch in raw_phone if ch.isdigit())


def _format_twilio_whatsapp_address(raw_phone: str) -> str:
    cleaned = _clean_phone(raw_phone)
    if not cleaned:
        return ""
    return f"whatsapp:+{cleaned}"


def _format_twilio_from(raw_from: str) -> str:
    raw_from = raw_from.strip()
    if not raw_from:
        return ""
    if raw_from.startswith("whatsapp:"):
        return raw_from
    if raw_from.startswith("+"):
        return f"whatsapp:{raw_from}"
    cleaned = _clean_phone(raw_from)
    return f"whatsapp:+{cleaned}" if cleaned else raw_from


def _format_value(value: Decimal | None) -> str:
    if value is None:
        return "N/D"
    return f"{float(value):g}"


def _format_timestamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M UTC")


def build_alert_template_variables(context: WhatsAppAlertContext) -> dict[str, str]:
    alert = context.alert
    return {
        "1": context.area_name,
        "2": context.node_name,
        "3": alert.parametro or alert.tipo,
        "4": _format_value(alert.valor_detectado),
        "5": _format_timestamp(alert.marca_tiempo),
        "6": context.recommendation_url,
    }


def build_alert_text_message(context: WhatsAppAlertContext) -> str:
    return (
        f"{context.message}\n\n"
        f"Ver recomendacion: {context.recommendation_url}"
    )


def _send_meta_text(context: WhatsAppAlertContext) -> bool:
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_ACCESS_TOKEN:
        return False

    api_base = settings.WHATSAPP_API_BASE_URL.rstrip("/")
    url = f"{api_base}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": _clean_phone(context.recipient_phone),
        "type": "text",
        "text": {
            "preview_url": False,
            "body": build_alert_text_message(context),
        },
    }
    body = json.dumps(payload).encode("utf-8")

    req = request.Request(url=url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}")

    try:
        with request.urlopen(req, timeout=settings.WHATSAPP_HTTP_TIMEOUT_SECONDS) as resp:
            return 200 <= resp.status < 300
    except (error.HTTPError, error.URLError, TimeoutError):
        return False


def _send_meta_template(context: WhatsAppAlertContext) -> bool:
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_ACCESS_TOKEN:
        return False

    api_base = settings.WHATSAPP_API_BASE_URL.rstrip("/")
    url = f"{api_base}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    variables = build_alert_template_variables(context)
    payload = {
        "messaging_product": "whatsapp",
        "to": _clean_phone(context.recipient_phone),
        "type": "template",
        "template": {
            "name": settings.WHATSAPP_TEMPLATE_NAME,
            "language": {"code": settings.WHATSAPP_TEMPLATE_LANGUAGE_CODE},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": variables[str(index)]}
                        for index in range(1, 7)
                    ],
                }
            ],
        },
    }
    body = json.dumps(payload).encode("utf-8")

    req = request.Request(url=url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}")

    try:
        with request.urlopen(req, timeout=settings.WHATSAPP_HTTP_TIMEOUT_SECONDS) as resp:
            return 200 <= resp.status < 300
    except (error.HTTPError, error.URLError, TimeoutError):
        return False


def _send_twilio_template(context: WhatsAppAlertContext) -> bool:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        return False
    if not settings.TWILIO_CONTENT_SID:
        return False

    to_address = _format_twilio_whatsapp_address(context.recipient_phone)
    from_address = _format_twilio_from(settings.TWILIO_WHATSAPP_FROM)
    if not to_address:
        return False
    if not from_address and not settings.TWILIO_MESSAGING_SERVICE_SID:
        return False

    url = (
        f"{settings.TWILIO_API_BASE_URL.rstrip('/')}/2010-04-01/Accounts/"
        f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    form_data = {
        "To": to_address,
        "ContentSid": settings.TWILIO_CONTENT_SID,
        "ContentVariables": json.dumps(build_alert_template_variables(context)),
    }
    if settings.TWILIO_MESSAGING_SERVICE_SID:
        form_data["MessagingServiceSid"] = settings.TWILIO_MESSAGING_SERVICE_SID
    else:
        form_data["From"] = from_address
    if settings.TWILIO_STATUS_CALLBACK_URL:
        form_data["StatusCallback"] = settings.TWILIO_STATUS_CALLBACK_URL

    body = parse.urlencode(form_data).encode("utf-8")
    req = request.Request(url=url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    token = base64.b64encode(
        f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode("utf-8")
    ).decode("ascii")
    req.add_header("Authorization", f"Basic {token}")

    try:
        with request.urlopen(req, timeout=settings.WHATSAPP_HTTP_TIMEOUT_SECONDS) as resp:
            return 200 <= resp.status < 300
    except (error.HTTPError, error.URLError, TimeoutError):
        return False


def _send_twilio_text(context: WhatsAppAlertContext) -> bool:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        return False

    to_address = _format_twilio_whatsapp_address(context.recipient_phone)
    from_address = _format_twilio_from(settings.TWILIO_WHATSAPP_FROM)
    if not to_address:
        return False
    if not from_address and not settings.TWILIO_MESSAGING_SERVICE_SID:
        return False

    url = (
        f"{settings.TWILIO_API_BASE_URL.rstrip('/')}/2010-04-01/Accounts/"
        f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    form_data = {
        "To": to_address,
        "Body": build_alert_text_message(context),
    }
    if settings.TWILIO_MESSAGING_SERVICE_SID:
        form_data["MessagingServiceSid"] = settings.TWILIO_MESSAGING_SERVICE_SID
    else:
        form_data["From"] = from_address
    if settings.TWILIO_STATUS_CALLBACK_URL:
        form_data["StatusCallback"] = settings.TWILIO_STATUS_CALLBACK_URL

    body = parse.urlencode(form_data).encode("utf-8")
    req = request.Request(url=url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    token = base64.b64encode(
        f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode("utf-8")
    ).decode("ascii")
    req.add_header("Authorization", f"Basic {token}")

    try:
        with request.urlopen(req, timeout=settings.WHATSAPP_HTTP_TIMEOUT_SECONDS) as resp:
            return 200 <= resp.status < 300
    except (error.HTTPError, error.URLError, TimeoutError):
        return False


def send_whatsapp_alert(context: WhatsAppAlertContext) -> bool:
    provider = settings.WHATSAPP_PROVIDER.strip().lower()
    message_mode = settings.WHATSAPP_MESSAGE_MODE.strip().lower()
    if provider == "twilio":
        if message_mode == "text":
            return _send_twilio_text(context)
        return _send_twilio_template(context)
    if provider == "meta":
        if message_mode == "text":
            return _send_meta_text(context)
        return _send_meta_template(context)
    return False
