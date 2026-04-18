from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.irrigation_area import IrrigationArea
from app.models.notification_preference import NotificationPreference
from app.models.property import Property
from app.schemas.notification_preference import NotificationPreferenceUpsertItem

ALLOWED_ALERT_TYPES = {"threshold", "inactivity"}
ALLOWED_SEVERITIES = {"info", "warning", "critical"}
ALLOWED_CHANNELS = {"email", "whatsapp"}


def get_client_area_ids(db: Session, client_id: int) -> list[int]:
    return list(
        db.execute(
            select(IrrigationArea.id)
            .join(Property, Property.id == IrrigationArea.predio_id)
            .where(
                Property.cliente_id == client_id,
                Property.eliminado_en.is_(None),
                IrrigationArea.eliminado_en.is_(None),
            )
        ).scalars()
    )


def list_notification_preferences(
    db: Session,
    *,
    page: int,
    per_page: int,
    client_id: int | None = None,
    irrigation_area_id: int | None = None,
    alert_type: str | None = None,
    severity: str | None = None,
    channel: str | None = None,
    allowed_area_ids: list[int] | None = None,
) -> tuple[list[NotificationPreference], int]:
    conditions = []

    if allowed_area_ids is not None:
        if not allowed_area_ids:
            return [], 0
        conditions.append(NotificationPreference.area_riego_id.in_(allowed_area_ids))

    if client_id is not None:
        conditions.append(NotificationPreference.cliente_id == client_id)
    if irrigation_area_id is not None:
        conditions.append(NotificationPreference.area_riego_id == irrigation_area_id)
    if alert_type is not None:
        conditions.append(NotificationPreference.tipo_alerta == alert_type)
    if severity is not None:
        conditions.append(NotificationPreference.severidad == severity)
    if channel is not None:
        conditions.append(NotificationPreference.canal == channel)

    total = (
        db.execute(
            select(func.count()).select_from(NotificationPreference).where(*conditions)
        ).scalar()
        or 0
    )

    items = list(
        db.execute(
            select(NotificationPreference)
            .where(*conditions)
            .order_by(NotificationPreference.id)
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )
    return items, total


def bulk_upsert_notification_preferences(
    db: Session,
    *,
    client_id: int,
    allowed_area_ids: set[int],
    items: list[NotificationPreferenceUpsertItem],
) -> tuple[int, int, list[NotificationPreference]]:
    created = 0
    updated = 0
    touched: list[NotificationPreference] = []

    for item in items:
        if item.alert_type not in ALLOWED_ALERT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported alert_type '{item.alert_type}'",
            )
        if item.severity not in ALLOWED_SEVERITIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported severity '{item.severity}'",
            )
        if item.channel not in ALLOWED_CHANNELS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported channel '{item.channel}'",
            )
        if item.irrigation_area_id not in allowed_area_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this irrigation area",
            )

        existing = db.execute(
            select(NotificationPreference).where(
                NotificationPreference.cliente_id == client_id,
                NotificationPreference.area_riego_id == item.irrigation_area_id,
                NotificationPreference.tipo_alerta == item.alert_type,
                NotificationPreference.severidad == item.severity,
                NotificationPreference.canal == item.channel,
            )
        ).scalar_one_or_none()

        if existing is None:
            pref = NotificationPreference(
                cliente_id=client_id,
                area_riego_id=item.irrigation_area_id,
                tipo_alerta=item.alert_type,
                severidad=item.severity,
                canal=item.channel,
                habilitado=item.enabled,
            )
            db.add(pref)
            db.flush()
            created += 1
            touched.append(pref)
            continue

        if existing.habilitado != item.enabled:
            existing.habilitado = item.enabled
            updated += 1
        touched.append(existing)

    db.commit()
    return created, updated, touched
