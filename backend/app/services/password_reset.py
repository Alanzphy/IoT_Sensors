import hashlib
import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from urllib.parse import quote

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User


def _build_reset_link(raw_token: str) -> str:
    return f"{settings.PASSWORD_RESET_URL_BASE}?token={quote(raw_token)}"


def _hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _generate_raw_reset_token() -> str:
    return secrets.token_urlsafe(48)


def _send_reset_email(*, recipient_email: str, reset_link: str) -> bool:
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    if not settings.SMTP_HOST or not from_email:
        return False

    msg = EmailMessage()
    msg["Subject"] = (
        f"{settings.NOTIFICATION_EMAIL_SUBJECT_PREFIX} Recuperacion de contrasena"
    )
    msg["From"] = from_email
    msg["To"] = recipient_email
    msg.set_content(
        "\n".join(
            [
                "Recibimos una solicitud para restablecer tu contrasena.",
                "Si no la solicitaste, puedes ignorar este mensaje.",
                "",
                f"Enlace de recuperacion: {reset_link}",
                "",
                f"Este enlace expira en {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutos.",
            ]
        )
    )

    try:
        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=20
            ) as smtp:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
            return True

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_TLS:
                smtp.starttls()
                smtp.ehlo()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception:
        return False


def request_password_reset(*, db: Session, email: str) -> None:
    user = db.execute(
        select(User).where(
            User.correo == email,
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if user is None:
        return

    now_utc = datetime.now(UTC).replace(tzinfo=None)

    # Keep only one active token per user.
    db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.usuario_id == user.id,
            PasswordResetToken.usado_en.is_(None),
        )
    )

    raw_token = _generate_raw_reset_token()
    token = PasswordResetToken(
        usuario_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expira_en=now_utc
        + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    )
    db.add(token)
    db.commit()

    reset_link = _build_reset_link(raw_token)
    _send_reset_email(recipient_email=user.correo, reset_link=reset_link)


def reset_password(*, db: Session, raw_token: str, new_password: str) -> bool:
    now_utc = datetime.now(UTC).replace(tzinfo=None)
    token_hash = _hash_reset_token(raw_token)

    token = db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.usado_en.is_(None),
            PasswordResetToken.expira_en >= now_utc,
        )
    ).scalar_one_or_none()

    if token is None:
        return False

    user = db.execute(
        select(User).where(
            User.id == token.usuario_id,
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if user is None:
        return False

    user.contrasena_hash = hash_password(new_password)
    token.usado_en = now_utc

    # Revoke existing refresh sessions after password change.
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.usuario_id == user.id,
            RefreshToken.revocado_en.is_(None),
        )
        .values(revocado_en=now_utc)
    )

    db.commit()
    return True
