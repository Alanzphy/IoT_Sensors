from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_user(db: Session, user_id: int) -> User:
    user = db.execute(
        select(User).where(User.id == user_id, User.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )
    return user


def list_users(
    db: Session,
    page: int,
    per_page: int,
    role: str | None = None,
) -> tuple[list[User], int]:
    query = select(User).where(User.eliminado_en.is_(None))
    count_query = (
        select(func.count()).select_from(User).where(User.eliminado_en.is_(None))
    )
    if role:
        query = query.where(User.rol == role)
        count_query = count_query.where(User.rol == role)

    total = db.execute(count_query).scalar() or 0
    users = list(
        db.execute(
            query.order_by(User.id).offset((page - 1) * per_page).limit(per_page)
        ).scalars()
    )
    return users, total


def create_user(db: Session, data: UserCreate) -> User:
    existing = db.execute(
        select(User).where(User.correo == data.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{data.email}' already registered",
        )

    user = User(
        correo=data.email,
        contrasena_hash=hash_password(data.password),
        nombre_completo=data.full_name,
        rol=data.role,
        activo=data.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: UserUpdate) -> User:
    user = get_user(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != user.correo:
        existing = db.execute(
            select(User).where(User.correo == update_data["email"], User.id != user_id)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{update_data['email']}' already registered",
            )
        user.correo = update_data["email"]

    if "password" in update_data:
        user.contrasena_hash = hash_password(update_data["password"])
    if "full_name" in update_data:
        user.nombre_completo = update_data["full_name"]
    if "role" in update_data:
        user.rol = update_data["role"]
    if "is_active" in update_data:
        user.activo = update_data["is_active"]

    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user_id: int) -> User:
    user = get_user(db, user_id)
    user.eliminado_en = func.now()
    user.activo = False
    db.commit()
    db.refresh(user)
    return user
