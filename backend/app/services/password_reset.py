import hashlib
import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from urllib.parse import quote

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services.audit_log import create_audit_log


class ResetPasswordResult:
    SUCCESS = "success"
    INVALID_TOKEN = "invalid_token"
    RATE_LIMITED = "rate_limited"


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

    msg.add_alternative(
        f"""
        <html>
          <body style=\"margin:0;padding:0;background:#F4F1EB;font-family:Segoe UI,Arial,sans-serif;color:#2C2621;\">
            <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"padding:24px 0;\">
              <tr>
                <td align=\"center\">
                  <table role=\"presentation\" width=\"560\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#F9F8F4;border-radius:20px;padding:28px;border:1px solid #E7E2D9;\">
                    <tr>
                      <td>
                        <h2 style=\"margin:0 0 12px 0;font-size:24px;color:#2C2621;\">Restablecer contrasena</h2>
                        <p style=\"margin:0 0 14px 0;line-height:1.6;color:#4A4038;\">Recibimos una solicitud para restablecer tu contrasena en Sensores IoT.</p>
                        <p style=\"margin:0 0 20px 0;line-height:1.6;color:#4A4038;\">Si no solicitaste este cambio, puedes ignorar este correo.</p>
                        <p style=\"margin:0 0 22px 0;\"><a href=\"{reset_link}\" style=\"display:inline-block;background:#6D7E5E;color:#F4F1EB;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;\">Restablecer contrasena</a></p>
                        <p style=\"margin:0 0 8px 0;line-height:1.6;color:#6E6359;\">Este enlace expira en {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutos.</p>
                        <p style=\"margin:0;line-height:1.6;color:#6E6359;word-break:break-all;\">Si el boton no funciona, copia y pega este enlace en tu navegador:<br />{reset_link}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """,
        subtype="html",
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


def _rate_limit_count(
    *,
    db: Session,
    entity: str,
    entity_id: str,
    window_minutes: int,
) -> int:
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=window_minutes)
    return (
        db.execute(
            select(func.count())
            .select_from(AuditLog)
            .where(
                AuditLog.entidad == entity,
                AuditLog.entidad_id == entity_id,
                AuditLog.accion == "attempt",
                AuditLog.creado_en >= cutoff,
            )
        ).scalar()
        or 0
    )


def _mark_attempt(*, db: Session, entity: str, entity_id: str, detail: str | None = None) -> None:
    create_audit_log(
        db,
        user_id=None,
        action="attempt",
        entity=entity,
        entity_id=entity_id,
        detail=detail,
    )


def _audit_recovery_event(
    *,
    db: Session,
    action: str,
    entity_id: str | None,
    detail: str | None,
    user_id: int | None = None,
) -> None:
    create_audit_log(
        db,
        user_id=user_id,
        action=action,
        entity="password_recovery",
        entity_id=entity_id,
        detail=detail,
    )


def request_password_reset(*, db: Session, email: str, request_ip: str | None = None) -> None:
    normalized_email = email.strip().lower()
    resolved_ip = (request_ip or "unknown").strip() or "unknown"

    email_attempts = _rate_limit_count(
        db=db,
        entity="password_reset_forgot_email",
        entity_id=normalized_email,
        window_minutes=settings.PASSWORD_RESET_REQUEST_RATE_LIMIT_WINDOW_MINUTES,
    )
    ip_attempts = _rate_limit_count(
        db=db,
        entity="password_reset_forgot_ip",
        entity_id=resolved_ip,
        window_minutes=settings.PASSWORD_RESET_REQUEST_RATE_LIMIT_WINDOW_MINUTES,
    )

    if (
        email_attempts >= settings.PASSWORD_RESET_REQUEST_MAX_PER_EMAIL
        or ip_attempts >= settings.PASSWORD_RESET_REQUEST_MAX_PER_IP
    ):
        _audit_recovery_event(
            db=db,
            action="rate_limited_forgot",
            entity_id=normalized_email,
            detail=f"ip={resolved_ip}",
        )
        return

    _mark_attempt(
        db=db,
        entity="password_reset_forgot_email",
        entity_id=normalized_email,
        detail=f"ip={resolved_ip}",
    )
    _mark_attempt(
        db=db,
        entity="password_reset_forgot_ip",
        entity_id=resolved_ip,
        detail=f"email={normalized_email}",
    )

    user = db.execute(
        select(User).where(
            User.correo == normalized_email,
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if user is None:
        _audit_recovery_event(
            db=db,
            action="ignored_unknown_email",
            entity_id=normalized_email,
            detail=f"ip={resolved_ip}",
        )
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
    sent = _send_reset_email(recipient_email=user.correo, reset_link=reset_link)

    _audit_recovery_event(
        db=db,
        action="token_issued",
        entity_id=str(user.id),
        detail=f"ip={resolved_ip}",
        user_id=user.id,
    )
    _audit_recovery_event(
        db=db,
        action="email_sent" if sent else "email_send_failed",
        entity_id=str(user.id),
        detail=f"ip={resolved_ip};email={user.correo}",
        user_id=user.id,
    )


def reset_password(
    *,
    db: Session,
    raw_token: str,
    new_password: str,
    request_ip: str | None = None,
) -> str:
    resolved_ip = (request_ip or "unknown").strip() or "unknown"

    ip_attempts = _rate_limit_count(
        db=db,
        entity="password_reset_confirm_ip",
        entity_id=resolved_ip,
        window_minutes=settings.PASSWORD_RESET_CONFIRM_RATE_LIMIT_WINDOW_MINUTES,
    )
    if ip_attempts >= settings.PASSWORD_RESET_CONFIRM_MAX_PER_IP:
        _audit_recovery_event(
            db=db,
            action="rate_limited_reset",
            entity_id=resolved_ip,
            detail=None,
        )
        return ResetPasswordResult.RATE_LIMITED

    _mark_attempt(
        db=db,
        entity="password_reset_confirm_ip",
        entity_id=resolved_ip,
        detail=None,
    )

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
        _audit_recovery_event(
            db=db,
            action="invalid_or_expired_token",
            entity_id=resolved_ip,
            detail=None,
        )
        return ResetPasswordResult.INVALID_TOKEN

    user = db.execute(
        select(User).where(
            User.id == token.usuario_id,
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if user is None:
        _audit_recovery_event(
            db=db,
            action="invalid_token_user",
            entity_id=resolved_ip,
            detail=None,
        )
        return ResetPasswordResult.INVALID_TOKEN

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
    _audit_recovery_event(
        db=db,
        action="password_reset_success",
        entity_id=str(user.id),
        detail=f"ip={resolved_ip}",
        user_id=user.id,
    )
    return ResetPasswordResult.SUCCESS
