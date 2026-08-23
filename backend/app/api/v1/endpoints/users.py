from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.user import (
    UserCreate,
    UserProfileUpdate,
    UserResponse,
    UserUpdate,
)
from app.services import user as user_service

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's own profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update editable profile fields of the authenticated user (email not editable)."""
    user = user_service.update_user(
        db,
        current_user.id,
        UserUpdate(**data.model_dump(exclude_unset=True)),
    )
    return UserResponse.model_validate(user)


@router.get("", response_model=PaginatedResponse[UserResponse])
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    role: str | None = Query(None),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users, total = user_service.list_users(db, page, per_page, role)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[UserResponse.model_validate(u) for u in users],
    )


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = user_service.create_user(db, data)
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = user_service.get_user(db, user_id)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = user_service.update_user(db, user_id, data)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = user_service.soft_delete_user(db, user_id)
    return UserResponse.model_validate(user)
