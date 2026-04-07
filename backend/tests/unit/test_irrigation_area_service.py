"""Tests unitarios para app.services.irrigation_area."""

import pytest
from fastapi import HTTPException

from app.schemas.irrigation_area import IrrigationAreaCreate, IrrigationAreaUpdate
from app.services import irrigation_area as ia_service


class TestCreateIrrigationArea:
    def test_create_success(self, db, sample_property, sample_crop_type):
        data = IrrigationAreaCreate(
            property_id=sample_property.id,
            crop_type_id=sample_crop_type.id,
            name="Área Norte",
            area_size=15.0,
        )
        area = ia_service.create_irrigation_area(db, data)
        assert area.id is not None
        assert area.nombre == "Área Norte"
        assert area.predio_id == sample_property.id
        assert area.tipo_cultivo_id == sample_crop_type.id

    def test_create_invalid_property_raises_404(self, db, sample_crop_type):
        data = IrrigationAreaCreate(
            property_id=99999,
            crop_type_id=sample_crop_type.id,
            name="Área Inválida",
        )
        with pytest.raises(HTTPException) as exc:
            ia_service.create_irrigation_area(db, data)
        assert exc.value.status_code == 404

    def test_create_invalid_crop_type_raises_404(self, db, sample_property):
        data = IrrigationAreaCreate(
            property_id=sample_property.id,
            crop_type_id=99999,
            name="Área Inválida",
        )
        with pytest.raises(HTTPException) as exc:
            ia_service.create_irrigation_area(db, data)
        assert exc.value.status_code == 404


class TestGetIrrigationArea:
    def test_get_existing(self, db, sample_irrigation_area):
        fetched = ia_service.get_irrigation_area(db, sample_irrigation_area.id)
        assert fetched.id == sample_irrigation_area.id

    def test_get_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            ia_service.get_irrigation_area(db, 99999)
        assert exc.value.status_code == 404


class TestListIrrigationAreas:
    def test_list_returns_items(self, db, sample_irrigation_area):
        items, total = ia_service.list_irrigation_areas(db, page=1, per_page=50)
        assert total >= 1

    def test_filter_by_property(self, db, sample_irrigation_area, sample_property):
        items, total = ia_service.list_irrigation_areas(
            db, page=1, per_page=50, property_id=sample_property.id
        )
        assert total >= 1
        assert all(i.predio_id == sample_property.id for i in items)


class TestUpdateIrrigationArea:
    def test_update_name(self, db, sample_irrigation_area):
        updated = ia_service.update_irrigation_area(
            db, sample_irrigation_area.id, IrrigationAreaUpdate(name="Nuevo Nombre")
        )
        assert updated.nombre == "Nuevo Nombre"

    def test_update_area_size(self, db, sample_irrigation_area):
        updated = ia_service.update_irrigation_area(
            db, sample_irrigation_area.id, IrrigationAreaUpdate(area_size=25.5)
        )
        assert float(updated.tamano_area) == 25.5

    def test_update_invalid_crop_type_raises_404(self, db, sample_irrigation_area):
        with pytest.raises(HTTPException) as exc:
            ia_service.update_irrigation_area(
                db, sample_irrigation_area.id, IrrigationAreaUpdate(crop_type_id=99999)
            )
        assert exc.value.status_code == 404


class TestSoftDeleteIrrigationArea:
    def test_soft_delete(self, db, sample_property, sample_crop_type):
        from app.models.irrigation_area import IrrigationArea

        area = IrrigationArea(
            predio_id=sample_property.id,
            tipo_cultivo_id=sample_crop_type.id,
            nombre="Para Borrar",
        )
        db.add(area)
        db.commit()
        db.refresh(area)

        ia_service.soft_delete_irrigation_area(db, area.id)
        with pytest.raises(HTTPException) as exc:
            ia_service.get_irrigation_area(db, area.id)
        assert exc.value.status_code == 404
