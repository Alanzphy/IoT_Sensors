"""Tests unitarios para app.services.property."""

import pytest
from fastapi import HTTPException

from app.models.client import Client
from app.models.user import User
from app.schemas.property import PropertyCreate, PropertyUpdate
from app.services import property as property_service
from app.core.security import hash_password


def _make_client(db, email="prop_client@test.com"):
    """Helper: crea user + client en BD."""
    user = User(
        correo=email,
        contrasena_hash=hash_password("pass"),
        nombre_completo="Prop Client",
        rol="cliente",
        activo=True,
    )
    db.add(user)
    db.flush()
    client = Client(usuario_id=user.id, nombre_empresa="Empresa XYZ")
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


class TestCreateProperty:
    def test_create_success(self, db):
        client = _make_client(db)
        data = PropertyCreate(client_id=client.id, name="Rancho Norte", location="Chihuahua")
        prop = property_service.create_property(db, data)
        assert prop.id is not None
        assert prop.nombre == "Rancho Norte"
        assert prop.cliente_id == client.id

    def test_create_with_invalid_client_raises_404(self, db):
        data = PropertyCreate(client_id=99999, name="Rancho Inexistente")
        with pytest.raises(HTTPException) as exc:
            property_service.create_property(db, data)
        assert exc.value.status_code == 404

    def test_create_without_location(self, db):
        client = _make_client(db, email="p2@test.com")
        data = PropertyCreate(client_id=client.id, name="Sin Ubicación")
        prop = property_service.create_property(db, data)
        assert prop.ubicacion is None


class TestGetProperty:
    def test_get_existing(self, db):
        client = _make_client(db, email="gp@test.com")
        prop = property_service.create_property(
            db, PropertyCreate(client_id=client.id, name="Mi Predio")
        )
        fetched = property_service.get_property(db, prop.id)
        assert fetched.id == prop.id

    def test_get_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            property_service.get_property(db, 99999)
        assert exc.value.status_code == 404


class TestListProperties:
    def test_list_all(self, db):
        client = _make_client(db, email="lp@test.com")
        property_service.create_property(db, PropertyCreate(client_id=client.id, name="P1"))
        property_service.create_property(db, PropertyCreate(client_id=client.id, name="P2"))
        items, total = property_service.list_properties(db, page=1, per_page=50)
        assert total >= 2

    def test_filter_by_client(self, db):
        c1 = _make_client(db, email="c1@test.com")
        c2 = _make_client(db, email="c2@test.com")
        property_service.create_property(db, PropertyCreate(client_id=c1.id, name="C1P1"))
        property_service.create_property(db, PropertyCreate(client_id=c2.id, name="C2P1"))
        items, total = property_service.list_properties(db, page=1, per_page=50, client_id=c1.id)
        assert total == 1
        assert all(i.cliente_id == c1.id for i in items)


class TestUpdateProperty:
    def test_update_name(self, db):
        client = _make_client(db, email="up@test.com")
        prop = property_service.create_property(
            db, PropertyCreate(client_id=client.id, name="Old Name")
        )
        updated = property_service.update_property(db, prop.id, PropertyUpdate(name="New Name"))
        assert updated.nombre == "New Name"

    def test_update_location(self, db):
        client = _make_client(db, email="ul@test.com")
        prop = property_service.create_property(
            db, PropertyCreate(client_id=client.id, name="Predio X")
        )
        updated = property_service.update_property(
            db, prop.id, PropertyUpdate(location="Sonora, MX")
        )
        assert updated.ubicacion == "Sonora, MX"


class TestSoftDeleteProperty:
    def test_soft_delete(self, db):
        client = _make_client(db, email="dp@test.com")
        prop = property_service.create_property(
            db, PropertyCreate(client_id=client.id, name="To Delete")
        )
        property_service.soft_delete_property(db, prop.id)
        with pytest.raises(HTTPException) as exc:
            property_service.get_property(db, prop.id)
        assert exc.value.status_code == 404
