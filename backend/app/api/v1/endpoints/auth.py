from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
)
from app.services import password_reset as password_reset_service

router = APIRouter()


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first = forwarded_for.split(",", maxsplit=1)[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return access + refresh tokens."""
    user = db.execute(
        select(User).where(
            User.correo == body.email,
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if user is None or not verify_password(body.password, user.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    token_data = {"sub": str(user.id), "rol": user.rol, "nombre": user.nombre_completo}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Persist refresh token
    payload = decode_token(refresh_token)
    expira_en = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)  # type: ignore[index]
    db_token = RefreshToken(
        usuario_id=user.id,
        token=refresh_token,
        expira_en=expira_en,
    )
    db.add(db_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/docs-login", include_in_schema=False)
def docs_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Endpoint exclusivo para Swagger UI que acepta form-data en lugar de JSON."""
    user = db.execute(
        select(User).where(
            User.correo == form_data.username,
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if user is None or not verify_password(form_data.password, user.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    token_data = {"sub": str(user.id), "rol": user.rol, "nombre": user.nombre_completo}
    access_token = create_access_token(token_data)

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=RefreshResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    # Check the token exists and is not revoked
    db_token = db.execute(
        select(RefreshToken).where(
            RefreshToken.token == body.refresh_token,
            RefreshToken.revocado_en.is_(None),
        )
    ).scalar_one_or_none()

    if db_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revocado o no encontrado",
        )

    token_data = {
        "sub": payload["sub"],
        "rol": payload["rol"],
        "nombre": payload.get("nombre", ""),
    }
    new_access_token = create_access_token(token_data)

    return RefreshResponse(access_token=new_access_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke a refresh token (logout)."""
    db_token = db.execute(
        select(RefreshToken).where(
            RefreshToken.token == body.refresh_token,
            RefreshToken.revocado_en.is_(None),
        )
    ).scalar_one_or_none()

    if db_token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token no encontrado o ya revocado",
        )

    db_token.revocado_en = datetime.now(timezone.utc)
    db.commit()

    return {"detail": "Sesión cerrada exitosamente"}


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
)
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generate a one-time reset token and email a recovery link."""
    password_reset_service.request_password_reset(
        db=db,
        email=body.email,
        request_ip=_resolve_client_ip(request),
    )
    return {
        "detail": (
            "Si el correo existe y esta activo, se envio un enlace de recuperacion."
        )
    }


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Token invalido, expirado o ya utilizado"},
        429: {
            "description": "Demasiados intentos de restablecimiento desde la misma IP"
        },
    },
)
def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Reset password using a valid one-time recovery token."""
    result = password_reset_service.reset_password(
        db=db,
        raw_token=body.token,
        new_password=body.new_password,
        request_ip=_resolve_client_ip(request),
    )
    if result == password_reset_service.ResetPasswordResult.RATE_LIMITED:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos de restablecimiento. Intenta de nuevo mas tarde",
        )
    if result != password_reset_service.ResetPasswordResult.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalido, expirado o ya utilizado",
        )
    return {"detail": "Contrasena actualizada exitosamente"}
