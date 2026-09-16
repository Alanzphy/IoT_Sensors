import json
from datetime import datetime
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.models import CropType, IrrigationArea, NDVILatestSnapshot
from app.schemas.ndvi import NDVIEvent
from app.services import ndvi as ndvi_service

FIXTURES = Path(__file__).parents[3] / "contracts/edge-cloud/v1/fixtures"
VALID_PAYLOAD = json.loads((FIXTURES / "ndvi.valid.json").read_text())
EXACT_TIMESTAMP = "2026-09-15T17:39:09.12345678901234567890Z"
OLDER_TIMESTAMP = "2026-09-15T17:39:09.123456788Z"
CURRENT_TIMESTAMP = "2026-09-15T17:39:09.123456789Z"
NEWER_TIMESTAMP = "2026-09-15T17:39:09.123456790Z"


def _payload(**overrides):
    return {**VALID_PAYLOAD, **overrides}


def _event(area_id: int, **overrides) -> NDVIEvent:
    return NDVIEvent.model_validate(_payload(irrigation_area_id=area_id, **overrides))


def _values(event: NDVIEvent) -> dict[str, object]:
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


def _assert_snapshot(snapshot: NDVILatestSnapshot, event: NDVIEvent) -> None:
    for field, value in _values(event).items():
        assert getattr(snapshot, field) == value


def test_create_and_exact_fractional_replay(db, sample_irrigation_area):
    event = _event(sample_irrigation_area.id, scene_observed_at=EXACT_TIMESTAMP)
    first = ndvi_service.store_latest_ndvi(db, sample_irrigation_area, event)
    replay = ndvi_service.store_latest_ndvi(db, sample_irrigation_area, event)

    _assert_snapshot(first, event)
    assert replay is first


def test_same_scene_with_different_data_conflicts(db, sample_irrigation_area):
    event = _event(sample_irrigation_area.id)
    ndvi_service.store_latest_ndvi(db, sample_irrigation_area, event)

    with pytest.raises(ndvi_service.NDVIConflictError):
        ndvi_service.store_latest_ndvi(
            db, sample_irrigation_area, _event(sample_irrigation_area.id, ndvi=0.64)
        )
    _assert_snapshot(db.get(NDVILatestSnapshot, sample_irrigation_area.id), event)


def test_fractional_ordering_replacement_and_area_isolation(
    db, sample_irrigation_area, sample_property, sample_crop_type
):
    current = _event(
        sample_irrigation_area.id,
        scene_id="current",
        scene_observed_at=CURRENT_TIMESTAMP,
    )
    ndvi_service.store_latest_ndvi(db, sample_irrigation_area, current)
    older = _event(
        sample_irrigation_area.id,
        scene_id="older",
        scene_observed_at=OLDER_TIMESTAMP,
    )
    with pytest.raises(ndvi_service.NDVIStaleError):
        ndvi_service.store_latest_ndvi(db, sample_irrigation_area, older)

    newer = _event(
        sample_irrigation_area.id,
        ndvi=-0.42,
        provider="Replacement provider",
        scene_id="newer",
        scene_observed_at=NEWER_TIMESTAMP,
        cloud_cover_percent=99.25,
    )
    _assert_snapshot(ndvi_service.store_latest_ndvi(db, sample_irrigation_area, newer), newer)

    other = IrrigationArea(
        predio_id=sample_property.id, tipo_cultivo_id=sample_crop_type.id, nombre="South"
    )
    db.add(other)
    db.flush([other])
    other_event = _event(other.id, ndvi=0.21, scene_id="other-scene")
    _assert_snapshot(ndvi_service.store_latest_ndvi(db, other, other_event), other_event)
    _assert_snapshot(db.get(NDVILatestSnapshot, sample_irrigation_area.id), newer)
    assert db.query(NDVILatestSnapshot).count() == 2


def test_service_does_not_flush_or_commit_caller_work(db, sample_irrigation_area, monkeypatch):
    pending = CropType(nombre="Caller pending work")
    db.add(pending)
    monkeypatch.setattr(db, "commit", lambda: pytest.fail("service called commit"))

    ndvi_service.store_latest_ndvi(db, sample_irrigation_area, _event(sample_irrigation_area.id))

    assert pending.id is None


def test_rejects_mismatched_missing_and_deleted_area(db, sample_irrigation_area):
    with pytest.raises(ndvi_service.NDVIAreaMismatchError):
        ndvi_service.store_latest_ndvi(
            db, sample_irrigation_area, _event(sample_irrigation_area.id + 1)
        )

    missing = IrrigationArea(id=99999, predio_id=1, tipo_cultivo_id=1, nombre="Missing")
    with pytest.raises(ndvi_service.NDVIAreaMismatchError):
        ndvi_service.store_latest_ndvi(db, missing, _event(missing.id))

    sample_irrigation_area.eliminado_en = datetime(2026, 9, 15)
    db.flush([sample_irrigation_area])
    with pytest.raises(ndvi_service.NDVIAreaMismatchError):
        ndvi_service.store_latest_ndvi(
            db, sample_irrigation_area, _event(sample_irrigation_area.id)
        )


@pytest.mark.parametrize(
    "overrides",
    [
        {"irrigation_area_id": 0},
        {"ndvi": 1.01},
        {"provider": ""},
        {"collection": "other"},
        {"scene_id": ""},
        {"scene_observed_at": "2026-09-15T17:39:09z"},
        {"scene_observed_at": "2026-02-30T17:39:09Z"},
        {"cloud_cover_percent": 100.01},
        {"sample_method": "polygon"},
        {"unexpected": True},
    ],
)
def test_schema_rejects_v1_constraint_violations(overrides):
    with pytest.raises(ValidationError):
        NDVIEvent.model_validate(_payload(**overrides))


@pytest.mark.parametrize(
    ("field", "invalid"),
    [
        ("ndvi", 2.0),
        ("proveedor", ""),
        ("coleccion", "other"),
        ("escena_id", ""),
        ("cobertura_nubes_porcentaje", 101.0),
        ("metodo_muestreo", "polygon"),
    ],
)
def test_database_checks(db, sample_irrigation_area, field, invalid):
    values = _values(_event(sample_irrigation_area.id))
    values[field] = invalid
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(NDVILatestSnapshot(**values))
            db.flush()


def test_area_identity_and_cascade_metadata():
    table = NDVILatestSnapshot.__table__
    assert [column.name for column in table.primary_key] == ["area_riego_id"]
    assert next(iter(table.foreign_keys)).ondelete == "CASCADE"
    assert "delete" in IrrigationArea.ndvi_snapshot.property.cascade
    assert IrrigationArea.ndvi_snapshot.property.passive_deletes is True
