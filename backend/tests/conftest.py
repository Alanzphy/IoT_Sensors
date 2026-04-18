"""
conftest.py — Fixtures globales para toda la suite de tests.

Estrategia de BD:
  - Se usa SQLite en memoria (no requiere Docker/MySQL corriendo).
  - El engine se crea una sola vez por sesión de pytest.
  - Las tablas se crean antes de la suite y se truncan entre tests
    para garantizar aislamiento sin coste de recrear el schema.
  - La dependencia `get_db` de FastAPI se hace override con esta BD.

Compatibilidad SQLite:
  - BigInteger en SQLite no hace autoincrement correctamente.
  - Usamos un evento de compilación DDL para mapear BigInteger → INTEGER
    en el dialecto de SQLite, permitiendo el autoincrement normal.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, Integer, create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, create_access_token
from app.db.session import Base, get_db
from app.main import app
from app.models import (  # noqa: F401 – importar todos para que Base los registre
    Client,
    CropCycle,
    CropType,
    IrrigationArea,
    Node,
    NotificationPreference,
    Property,
    Reading,
    RefreshToken,
    User,
)

# ---------------------------------------------------------------------------
# Compatibilidad SQLite: BigInteger → INTEGER para autoincrement
# ---------------------------------------------------------------------------

from sqlalchemy.dialects import sqlite as sqlite_dialect

BigInteger.__visit_name__ = "big_integer"  # type: ignore[attr-defined]

# When compiling DDL for SQLite, render BigInteger as plain INTEGER
# so that autoincrement works correctly.
from sqlalchemy.ext.compiler import compiles


@compiles(BigInteger, "sqlite")
def compile_big_integer_sqlite(type_, compiler, **kwargs):
    return "INTEGER"


# ---------------------------------------------------------------------------
# Engine SQLite en memoria (compartido entre todos los tests de la sesión)
# ---------------------------------------------------------------------------

SQLALCHEMY_TEST_URL = "sqlite:///:memory:?check_same_thread=False"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)


# Habilitar claves foráneas en SQLite (deshabilitadas por defecto)
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ---------------------------------------------------------------------------
# Crear/destruir tablas una sola vez por sesión de pytest
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Fixture de sesión DB: se rollbackea después de cada test
# ---------------------------------------------------------------------------


@pytest.fixture()
def db():
    """Sesión de BD limpia por cada test (rollback al finalizar)."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# Override de la dependencia get_db en la app FastAPI
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(db):
    """TestClient de FastAPI con la BD de test inyectada."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fixtures de datos base reutilizables
# ---------------------------------------------------------------------------


@pytest.fixture()
def admin_user(db):
    """Crea y retorna un usuario administrador."""
    user = User(
        correo="admin@test.com",
        contrasena_hash=hash_password("adminpass"),
        nombre_completo="Admin Test",
        rol="admin",
        activo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def admin_token(admin_user):
    """JWT access token para el admin."""
    return create_access_token(
        {
            "sub": str(admin_user.id),
            "rol": admin_user.rol,
            "nombre": admin_user.nombre_completo,
        }
    )


@pytest.fixture()
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def client_user(db):
    """Crea un usuario con rol 'cliente' y su registro Client."""
    user = User(
        correo="cliente@test.com",
        contrasena_hash=hash_password("clientepass"),
        nombre_completo="Cliente Test",
        rol="cliente",
        activo=True,
    )
    db.add(user)
    db.flush()

    client_record = Client(
        usuario_id=user.id,
        nombre_empresa="Empresa Test SA",
        telefono="555-0001",
        direccion="Calle Prueba 123",
    )
    db.add(client_record)
    db.commit()
    db.refresh(user)
    db.refresh(client_record)
    return user, client_record


@pytest.fixture()
def client_token(client_user):
    user, _ = client_user
    return create_access_token(
        {"sub": str(user.id), "rol": user.rol, "nombre": user.nombre_completo}
    )


@pytest.fixture()
def client_headers(client_token):
    return {"Authorization": f"Bearer {client_token}"}


@pytest.fixture()
def sample_crop_type(db):
    """Crea un tipo de cultivo de prueba."""
    ct = CropType(nombre="Nogal", descripcion="Nogal de prueba")
    db.add(ct)
    db.commit()
    db.refresh(ct)
    return ct


@pytest.fixture()
def sample_property(db, client_user):
    """Crea un predio de prueba vinculado al cliente de prueba."""
    _, client_record = client_user
    prop = Property(
        cliente_id=client_record.id,
        nombre="Rancho Test",
        ubicacion="Chihuahua, MX",
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@pytest.fixture()
def sample_irrigation_area(db, sample_property, sample_crop_type):
    """Crea un área de riego vinculada al predio y tipo de cultivo de prueba."""
    area = IrrigationArea(
        predio_id=sample_property.id,
        tipo_cultivo_id=sample_crop_type.id,
        nombre="Norte Nogal",
        tamano_area=10.5,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@pytest.fixture()
def sample_node(db, sample_irrigation_area):
    """Crea un nodo IoT de prueba."""
    node = Node(
        area_riego_id=sample_irrigation_area.id,
        api_key="ak_test_key_000",
        nombre="Nodo Test",
        latitud=28.6320,
        longitud=-106.0691,
        activo=True,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@pytest.fixture()
def node_headers(sample_node):
    """Headers con API Key válida para ingesta de sensores."""
    return {"X-API-Key": sample_node.api_key}


@pytest.fixture()
def sample_crop_cycle(db, sample_irrigation_area):
    """Crea un ciclo de cultivo activo (sin fecha_fin)."""
    from datetime import date

    cycle = CropCycle(
        area_riego_id=sample_irrigation_area.id,
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=None,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle
