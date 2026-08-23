import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(
    *,
    recipient_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> bool:
    """Send a plain-text (and optional HTML) email through the configured SMTP server."""
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME

    if not settings.SMTP_HOST or not from_email:
        logger.warning(
            "Email notification skipped: missing SMTP_HOST or from_email (to=%s)",
            recipient_email,
        )
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = recipient_email
    msg.set_content(body)
    if html_body is not None:
        msg.add_alternative(html_body, subtype="html")

    try:
        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=20,
            ) as smtp:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
            return True

        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_TLS:
                smtp.starttls()
                smtp.ehlo()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.warning(
            "Email notification failed: to=%s, host=%s, port=%s, tls=%s, ssl=%s, error=%s",
            recipient_email,
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USE_TLS,
            settings.SMTP_USE_SSL,
            exc,
        )
        return False