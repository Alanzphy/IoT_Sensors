"""Tests unitarios para app.services.crop_cycle."""

from datetime import date

import pytest
from fastapi import HTTPException

from app.schemas.crop_cycle import CropCycleCreate, CropCycleUpdate
from app.services import crop_cycle as cycle_service


class TestCreateCropCycle:
    def test_create_active_cycle_success(self, db, sample_irrigation_area):
        data = CropCycleCreate(
            irrigation_area_id=sample_irrigation_area.id,
            start_date=date(2026, 1, 1),
            end_date=None,
        )
        cycle = cycle_service.create_crop_cycle(db, data)
        assert cycle.id is not None
        assert cycle.area_riego_id == sample_irrigation_area.id
        assert cycle.fecha_fin is None

    def test_create_closed_cycle_success(self, db, sample_irrigation_area):
        data = CropCycleCreate(
            irrigation_area_id=sample_irrigation_area.id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
        )
        cycle = cycle_service.create_crop_cycle(db, data)
        assert cycle.fecha_fin == date(2025, 12, 31)

    def test_create_second_active_cycle_raises_409(self, db, sample_irrigation_area):
        """Solo puede existir 1 ciclo activo (sin fecha_fin) por área."""
        cycle_service.create_crop_cycle(
            db,
            CropCycleCreate(
                irrigation_area_id=sample_irrigation_area.id,
                start_date=date(2026, 1, 1),
            ),
        )
        with pytest.raises(HTTPException) as exc:
            cycle_service.create_crop_cycle(
                db,
                CropCycleCreate(
                    irrigation_area_id=sample_irrigation_area.id,
                    start_date=date(2026, 6, 1),
                ),
            )
        assert exc.value.status_code == 409

    def test_create_with_invalid_area_raises_404(self, db):
        data = CropCycleCreate(irrigation_area_id=99999, start_date=date(2026, 1, 1))
        with pytest.raises(HTTPException) as exc:
            cycle_service.create_crop_cycle(db, data)
        assert exc.value.status_code == 404

    def test_two_closed_cycles_allowed(self, db, sample_irrigation_area):
        """Dos ciclos con fecha_fin pueden coexistir."""
        cycle_service.create_crop_cycle(
            db,
            CropCycleCreate(
                irrigation_area_id=sample_irrigation_area.id,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
            ),
        )
        cycle2 = cycle_service.create_crop_cycle(
            db,
            CropCycleCreate(
                irrigation_area_id=sample_irrigation_area.id,
                start_date=date(2025, 1, 1),
                end_date=date(2025, 12, 31),
            ),
        )
        assert cycle2.id is not None


class TestGetCropCycle:
    def test_get_existing(self, db, sample_irrigation_area):
        cycle = cycle_service.create_crop_cycle(
            db, CropCycleCreate(irrigation_area_id=sample_irrigation_area.id, start_date=date(2026, 3, 1))
        )
        fetched = cycle_service.get_crop_cycle(db, cycle.id)
        assert fetched.id == cycle.id

    def test_get_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            cycle_service.get_crop_cycle(db, 99999)
        assert exc.value.status_code == 404


class TestUpdateCropCycle:
    def test_close_active_cycle(self, db, sample_irrigation_area):
        cycle = cycle_service.create_crop_cycle(
            db, CropCycleCreate(irrigation_area_id=sample_irrigation_area.id, start_date=date(2026, 1, 1))
        )
        updated = cycle_service.update_crop_cycle(
            db, cycle.id, CropCycleUpdate(end_date=date(2026, 6, 30))
        )
        assert updated.fecha_fin == date(2026, 6, 30)

    def test_update_start_date(self, db, sample_irrigation_area):
        cycle = cycle_service.create_crop_cycle(
            db, CropCycleCreate(
                irrigation_area_id=sample_irrigation_area.id,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 6, 30),
            )
        )
        updated = cycle_service.update_crop_cycle(
            db, cycle.id, CropCycleUpdate(start_date=date(2026, 2, 1))
        )
        assert updated.fecha_inicio == date(2026, 2, 1)


class TestListCropCycles:
    def test_list_for_area(self, db, sample_irrigation_area):
        cycle_service.create_crop_cycle(
            db, CropCycleCreate(
                irrigation_area_id=sample_irrigation_area.id,
                start_date=date(2025, 1, 1),
                end_date=date(2025, 12, 31),
            )
        )
        items, total = cycle_service.list_crop_cycles(
            db, page=1, per_page=50, irrigation_area_id=sample_irrigation_area.id
        )
        assert total >= 1


class TestSoftDeleteCropCycle:
    def test_soft_delete(self, db, sample_irrigation_area):
        cycle = cycle_service.create_crop_cycle(
            db, CropCycleCreate(
                irrigation_area_id=sample_irrigation_area.id,
                start_date=date(2025, 1, 1),
                end_date=date(2025, 12, 31),
            )
        )
        cycle_service.soft_delete_crop_cycle(db, cycle.id)
        with pytest.raises(HTTPException) as exc:
            cycle_service.get_crop_cycle(db, cycle.id)
        assert exc.value.status_code == 404
