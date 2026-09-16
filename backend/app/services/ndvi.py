from datetime import datetime
from decimal import Decimal
from typing import Literal, NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.irrigation_area import IrrigationArea
from app.models.ndvi_snapshot import NDVILatestSnapshot
from app.schemas.ndvi import NDVIEvent


class NDVIDomainError(Exception):
    """Base error for rejected latest-point NDVI events."""


class NDVIAreaMismatchError(NDVIDomainError):
    pass


class NDVIConflictError(NDVIDomainError):
    pass


class NDVIStaleError(NDVIDomainError):
    pass


class NDVIWriteResult(NamedTuple):
    snapshot: NDVILatestSnapshot
    action: Literal["created", "replaced", "replayed"]


def _timestamp_key(value: str) -> tuple[datetime, Decimal]:
    whole, _, fraction = value[:-1].partition(".")
    return datetime.strptime(whole, "%Y-%m-%dT%H:%M:%S"), Decimal(f"0.{fraction or '0'}")


def _event_values(event: NDVIEvent) -> dict[str, object]:
    return {
        "area_riego_id": event.irrigation_area_id,
        "ndvi": event.ndvi,
        "proveedor": event.provider,
        "coleccion": event.collection,
        "escena_id": event.scene_id,
        "escena_observada_en": event.scene_observed_at,
        "cobertura_nubes_porcentaje": event.cloud_cover_percent,
        "metodo_muestreo": event.sample_method,
    }


def store_latest_ndvi(
    db: Session,
    area: IrrigationArea,
    event: NDVIEvent,
) -> NDVILatestSnapshot:
    return store_latest_ndvi_with_result(db, area, event).snapshot


def store_latest_ndvi_with_result(
    db: Session,
    area: IrrigationArea,
    event: NDVIEvent,
) -> NDVIWriteResult:
    """Create, replay, or replace one area's current NDVI snapshot.

    The caller owns commit/rollback. MySQL callers using this service serialize on the area row;
    writers bypassing that lock may still surface an IntegrityError from the primary key.
    """
    if area.id != event.irrigation_area_id:
        raise NDVIAreaMismatchError("NDVI event does not match the irrigation-area context")

    with db.no_autoflush:
        locked_area_id = db.execute(
            select(IrrigationArea.id)
            .where(IrrigationArea.id == area.id, IrrigationArea.eliminado_en.is_(None))
            .with_for_update()
        ).scalar_one_or_none()
        if locked_area_id is None:
            raise NDVIAreaMismatchError("Irrigation-area context is missing or deleted")
        snapshot = db.execute(
            select(NDVILatestSnapshot).where(NDVILatestSnapshot.area_riego_id == area.id)
        ).scalar_one_or_none()
    values = _event_values(event)

    if snapshot is None:
        snapshot = NDVILatestSnapshot(**values)
        db.add(snapshot)
        action = "created"
    elif snapshot.escena_id == event.scene_id:
        if all(getattr(snapshot, field) == value for field, value in values.items()):
            return NDVIWriteResult(snapshot, "replayed")
        raise NDVIConflictError("Scene ID already exists with different NDVI event data")
    elif _timestamp_key(event.scene_observed_at) < _timestamp_key(snapshot.escena_observada_en):
        raise NDVIStaleError("NDVI event is older than the current snapshot")
    elif _timestamp_key(event.scene_observed_at) == _timestamp_key(snapshot.escena_observada_en):
        raise NDVIConflictError("Different scene IDs have the same observation time")
    else:
        for field, value in values.items():
            setattr(snapshot, field, value)
        action = "replaced"

    db.flush([snapshot])
    return NDVIWriteResult(snapshot, action)


def get_latest_ndvi(db: Session, irrigation_area_id: int) -> NDVILatestSnapshot | None:
    return db.get(NDVILatestSnapshot, irrigation_area_id)
