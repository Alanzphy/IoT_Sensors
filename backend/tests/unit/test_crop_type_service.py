"""Tests unitarios para app.services.crop_type."""

import pytest
from fastapi import HTTPException

from app.schemas.crop_type import CropTypeCreate, CropTypeUpdate
from app.services import crop_type as crop_type_service


def _make(name="Nogal", description=None):
    return CropTypeCreate(name=name, description=description)


class TestCreateCropType:
    def test_create_success(self, db):
        ct = crop_type_service.create_crop_type(db, _make("Alfalfa"))
        assert ct.id is not None
        assert ct.nombre == "Alfalfa"

    def test_create_with_description(self, db):
        ct = crop_type_service.create_crop_type(db, _make("Maíz", "Maíz dulce"))
        assert ct.descripcion == "Maíz dulce"

    def test_create_duplicate_name_raises_409(self, db):
        crop_type_service.create_crop_type(db, _make("Chile"))
        with pytest.raises(HTTPException) as exc:
            crop_type_service.create_crop_type(db, _make("Chile"))
        assert exc.value.status_code == 409


class TestGetCropType:
    def test_get_existing(self, db):
        ct = crop_type_service.create_crop_type(db, _make("Algodón"))
        fetched = crop_type_service.get_crop_type(db, ct.id)
        assert fetched.id == ct.id

    def test_get_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            crop_type_service.get_crop_type(db, 99999)
        assert exc.value.status_code == 404


class TestListCropTypes:
    def test_list_returns_items(self, db):
        crop_type_service.create_crop_type(db, _make("Manzana"))
        crop_type_service.create_crop_type(db, _make("Nogal2"))
        items, total = crop_type_service.list_crop_types(db, page=1, per_page=50)
        assert total >= 2

    def test_pagination_limits_results(self, db):
        for i in range(5):
            crop_type_service.create_crop_type(db, _make(f"Cultivo{i}"))
        items, total = crop_type_service.list_crop_types(db, page=1, per_page=2)
        assert len(items) == 2
        assert total >= 5

    def test_soft_deleted_not_shown(self, db):
        ct = crop_type_service.create_crop_type(db, _make("Deleted"))
        crop_type_service.soft_delete_crop_type(db, ct.id)
        items, _ = crop_type_service.list_crop_types(db, page=1, per_page=50)
        assert not any(i.id == ct.id for i in items)


class TestUpdateCropType:
    def test_update_name(self, db):
        ct = crop_type_service.create_crop_type(db, _make("OldName"))
        updated = crop_type_service.update_crop_type(db, ct.id, CropTypeUpdate(name="NewName"))
        assert updated.nombre == "NewName"

    def test_update_description(self, db):
        ct = crop_type_service.create_crop_type(db, _make("CT1"))
        updated = crop_type_service.update_crop_type(
            db, ct.id, CropTypeUpdate(description="Nueva descripción")
        )
        assert updated.descripcion == "Nueva descripción"


class TestSoftDeleteCropType:
    def test_soft_delete_marks_record(self, db):
        ct = crop_type_service.create_crop_type(db, _make("ToDelete"))
        crop_type_service.soft_delete_crop_type(db, ct.id)
        with pytest.raises(HTTPException) as exc:
            crop_type_service.get_crop_type(db, ct.id)
        assert exc.value.status_code == 404
