"""Tests unitarios para app.services.user."""

import pytest
from fastapi import HTTPException

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services import user as user_service


def _make_user_create(email="u@test.com", password="pass123", role="admin"):
    return UserCreate(
        email=email,
        password=password,
        full_name="Usuario Test",
        role=role,
        is_active=True,
    )


class TestCreateUser:
    def test_create_user_success(self, db):
        data = _make_user_create()
        user = user_service.create_user(db, data)
        assert user.id is not None
        assert user.correo == "u@test.com"
        assert user.rol == "admin"
        assert user.activo is True

    def test_password_is_hashed(self, db):
        data = _make_user_create(password="plaintext")
        user = user_service.create_user(db, data)
        assert user.contrasena_hash != "plaintext"
        assert verify_password("plaintext", user.contrasena_hash)

    def test_create_duplicate_email_raises_409(self, db):
        user_service.create_user(db, _make_user_create(email="dup@test.com"))
        with pytest.raises(HTTPException) as exc:
            user_service.create_user(db, _make_user_create(email="dup@test.com"))
        assert exc.value.status_code == 409

    def test_create_cliente_role(self, db):
        data = _make_user_create(email="cliente@test.com", role="cliente")
        user = user_service.create_user(db, data)
        assert user.rol == "cliente"


class TestGetUser:
    def test_get_existing_user(self, db):
        created = user_service.create_user(db, _make_user_create())
        fetched = user_service.get_user(db, created.id)
        assert fetched.id == created.id
        assert fetched.correo == created.correo

    def test_get_nonexistent_user_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            user_service.get_user(db, 99999)
        assert exc.value.status_code == 404

    def test_get_soft_deleted_user_raises_404(self, db):
        user = user_service.create_user(db, _make_user_create())
        user_service.soft_delete_user(db, user.id)
        with pytest.raises(HTTPException) as exc:
            user_service.get_user(db, user.id)
        assert exc.value.status_code == 404


class TestListUsers:
    def test_list_returns_created_users(self, db):
        user_service.create_user(db, _make_user_create(email="a@test.com"))
        user_service.create_user(db, _make_user_create(email="b@test.com"))
        users, total = user_service.list_users(db, page=1, per_page=50)
        assert total >= 2

    def test_list_pagination(self, db):
        for i in range(5):
            user_service.create_user(db, _make_user_create(email=f"page{i}@test.com"))
        users, total = user_service.list_users(db, page=1, per_page=2)
        assert len(users) == 2

    def test_list_filter_by_role(self, db):
        user_service.create_user(db, _make_user_create(email="r1@test.com", role="admin"))
        user_service.create_user(db, _make_user_create(email="r2@test.com", role="cliente"))
        admins, total = user_service.list_users(db, page=1, per_page=50, role="admin")
        assert all(u.rol == "admin" for u in admins)

    def test_soft_deleted_not_in_list(self, db):
        user = user_service.create_user(db, _make_user_create(email="del@test.com"))
        user_service.soft_delete_user(db, user.id)
        users, _ = user_service.list_users(db, page=1, per_page=50)
        assert not any(u.id == user.id for u in users)


class TestUpdateUser:
    def test_update_full_name(self, db):
        user = user_service.create_user(db, _make_user_create())
        updated = user_service.update_user(db, user.id, UserUpdate(full_name="Nuevo Nombre"))
        assert updated.nombre_completo == "Nuevo Nombre"

    def test_update_password(self, db):
        user = user_service.create_user(db, _make_user_create(password="old_pass"))
        user_service.update_user(db, user.id, UserUpdate(password="new_pass"))
        fresh = user_service.get_user(db, user.id)
        assert verify_password("new_pass", fresh.contrasena_hash)

    def test_update_email_to_existing_raises_409(self, db):
        u1 = user_service.create_user(db, _make_user_create(email="first@test.com"))
        u2 = user_service.create_user(db, _make_user_create(email="second@test.com"))
        with pytest.raises(HTTPException) as exc:
            user_service.update_user(db, u2.id, UserUpdate(email="first@test.com"))
        assert exc.value.status_code == 409


class TestSoftDeleteUser:
    def test_soft_delete_marks_eliminado_en(self, db):
        user = user_service.create_user(db, _make_user_create())
        user_service.soft_delete_user(db, user.id)
        db.expire(user)
        db.refresh(user)
        assert user.activo is False

    def test_soft_delete_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            user_service.soft_delete_user(db, 99999)
        assert exc.value.status_code == 404
