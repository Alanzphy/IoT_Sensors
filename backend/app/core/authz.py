from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User


def get_client_area_ids(user: User, db: Session) -> list[int] | None:
    """Resolve the irrigation area IDs visible to a user.

    Admin users see all areas (None means "no filter"); client users are
    scoped to their own areas through client -> properties -> areas, with
    soft-deleted records excluded at every level.
    """
    if user.rol == "admin":
        return None

    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id,
            Client.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if client is None:
        return []

    property_ids = list(
        db.execute(
            select(Property.id).where(
                Property.cliente_id == client.id,
                Property.eliminado_en.is_(None),
            )
        ).scalars()
    )
    if not property_ids:
        return []

    return list(
        db.execute(
            select(IrrigationArea.id).where(
                IrrigationArea.predio_id.in_(property_ids),
                IrrigationArea.eliminado_en.is_(None),
            )
        ).scalars()
    )


def validate_area_access(user: User, db: Session, irrigation_area_id: int) -> None:
    """Raise 403 unless the user (admin or area owner) can access the area."""
    if user.rol == "admin":
        return
    area_ids = get_client_area_ids(user, db)
    if irrigation_area_id not in area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this irrigation area",
        )


def require_admin(user: User) -> None:
    """Raise 403 unless the user has the admin role."""
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )