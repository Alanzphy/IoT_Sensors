"""Tests unitarios para app.services.client."""

import pytest
from fastapi import HTTPException

from app.models.client import Client
from app.models.property import Property
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate
from app.services import client as client_service


def _make_client_create(email="cli@test.com"):
    return ClientCreate(
        email=email,
        password="pass123",
        full_name="Cliente Fulano",
        company_name="Empresa ABC",
        phone="555-9999",
        address="Calle Falsa 123",
    )


class TestCreateClient:
    def test_create_client_creates_user_and_client(self, db):
        data = _make_client_create()
        client = client_service.create_client(db, data)
        assert client.id is not None
        assert client.nombre_empresa == "Empresa ABC"
        # La relación user debe estar cargada
        assert client.user is not None
        assert client.user.correo == "cli@test.com"
        assert client.user.rol == "cliente"

    def test_create_client_duplicate_email_raises_409(self, db):
        client_service.create_client(db, _make_client_create(email="dup@test.com"))
        with pytest.raises(HTTPException) as exc:
            client_service.create_client(db, _make_client_create(email="dup@test.com"))
        assert exc.value.status_code == 409

    def test_create_client_with_optional_fields_none(self, db):
        data = ClientCreate(
            email="minimal@test.com",
            password="pass",
            full_name="Min User",
            company_name="Min Corp",
        )
        client = client_service.create_client(db, data)
        assert client.telefono is None
        assert client.direccion is None


class TestGetClient:
    def test_get_existing_client(self, db):
        created = client_service.create_client(db, _make_client_create())
        fetched = client_service.get_client(db, created.id)
        assert fetched.id == created.id

    def test_get_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            client_service.get_client(db, 99999)
        assert exc.value.status_code == 404


class TestListClients:
    def test_list_returns_clients(self, db):
        client_service.create_client(db, _make_client_create(email="l1@test.com"))
        client_service.create_client(db, _make_client_create(email="l2@test.com"))
        clients, total = client_service.list_clients(db, page=1, per_page=50)
        assert total >= 2

    def test_soft_deleted_not_in_list(self, db):
        c = client_service.create_client(db, _make_client_create(email="gone@test.com"))
        client_service.soft_delete_client(db, c.id)
        clients, _ = client_service.list_clients(db, page=1, per_page=50)
        assert not any(cl.id == c.id for cl in clients)


class TestUpdateClient:
    def test_update_company_name(self, db):
        c = client_service.create_client(db, _make_client_create())
        updated = client_service.update_client(db, c.id, ClientUpdate(company_name="Nueva Empresa"))
        assert updated.nombre_empresa == "Nueva Empresa"

    def test_update_phone_and_address(self, db):
        c = client_service.create_client(db, _make_client_create())
        updated = client_service.update_client(
            db, c.id, ClientUpdate(phone="555-1111", address="Av. Nueva 456")
        )
        assert updated.telefono == "555-1111"
        assert updated.direccion == "Av. Nueva 456"


class TestSoftDeleteClient:
    def test_soft_delete_disables_user(self, db):
        c = client_service.create_client(db, _make_client_create(email="del@test.com"))
        client_service.soft_delete_client(db, c.id)
        db.expire(c)
        db.refresh(c)
        assert c.user.activo is False

    def test_soft_delete_cascades_to_properties(self, db):
        c = client_service.create_client(db, _make_client_create(email="del2@test.com"))
        prop = Property(cliente_id=c.id, nombre="Predio A")
        db.add(prop)
        db.commit()
        client_service.soft_delete_client(db, c.id)
        db.refresh(prop)
        assert prop.eliminado_en is not None
