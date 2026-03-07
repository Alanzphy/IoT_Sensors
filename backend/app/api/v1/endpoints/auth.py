from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
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
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    TokenResponse,
)

router = APIRouter()


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

    token_data = {"sub": str(user.id), "rol": user.rol}
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

    token_data = {"sub": payload["sub"], "rol": payload["rol"]}
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
