"""
Seed inicial: tipos de cultivo + usuarios + jerarquía de prueba completa.

Idempotente: comprueba existencia antes de insertar, seguro de ejecutar
múltiples veces.

Datos creados:
  Usuarios:
    - admin@sensores.com / admin123          (Administrador)
    - cliente@sensores.com / cliente123      (Cliente de prueba)
    - jlopez@test.com / admin123             (Cliente sin predios)

  Jerarquía de prueba:
    Cliente: Juan Perez
      └─ Predio: Rancho Norte
           ├─ Área: Nogal Norte   → Nodo Nogal Norte   (API Key: 99189486-...)
           ├─ Área: Alfalfa Este  → Nodo Alfalfa Este  (API Key: c1f5cd79-...)
           ├─ Área: Chile Princ.  → Nodo Chile Princ.  (API Key: 02b21674-...)
           └─ Área: Área 2        → Nodo Prueba E2E    (API Key: ak_b2727b...)
"""

import bcrypt
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.client import Client
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.user import User

# ---------------------------------------------------------------------------
# Datos de prueba — deben coincidir con TEST_DATA.md
# ---------------------------------------------------------------------------

CROP_TYPES = ["Nogal", "Alfalfa", "Manzana", "Maíz", "Chile", "Algodón"]

USERS = [
    {
        "correo": "admin@sensores.com",
        "password": "admin123",
        "nombre": "Administrador",
        "rol": "admin",
    },
    {
        "correo": "cliente@sensores.com",
        "password": "cliente123",
        "nombre": "Juan Perez",
        "rol": "cliente",
        "empresa": "Rancho Norte S.A.",
    },
    {
        "correo": "jlopez@test.com",
        "password": "admin123",
        "nombre": "Juan López",
        "rol": "cliente",
        "empresa": "Sin Empresa",
    },
]

# Áreas y nodos asociados al cliente de prueba (cliente@sensores.com)
# API Keys deben coincidir exactamente con TEST_DATA.md
AREAS_Y_NODOS = [
    {
        "area_nombre": "Nogal Norte",
        "cultivo": "Nogal",
        "tamano": 12.5,
        "nodo_nombre": "Nodo Nogal Norte",
        "api_key": "99189486-8181-4e8c-8c6d-b3da66e6712b",
        "lat": 29.0892,
        "lon": -110.9588,
    },
    {
        "area_nombre": "Alfalfa Este",
        "cultivo": "Alfalfa",
        "tamano": 8.0,
        "nodo_nombre": "Nodo Alfalfa Este",
        "api_key": "c1f5cd79-e760-4a9f-92ea-31ea685a3add",
        "lat": 29.0901,
        "lon": -110.9521,
    },
    {
        "area_nombre": "Chile Principal",
        "cultivo": "Chile",
        "tamano": 5.5,
        "nodo_nombre": "Nodo Chile Principal",
        "api_key": "02b21674-0099-4470-a8dd-b4ebd7d8c2b0",
        "lat": 29.0876,
        "lon": -110.9601,
    },
    {
        "area_nombre": "Área 2",
        "cultivo": "Maíz",
        "tamano": 6.0,
        "nodo_nombre": "Nodo Prueba E2E",
        "api_key": "ak_b2727bc1d95e342932612ee5573fdb18",
        "lat": None,
        "lon": None,
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_or_create(db, model, filter_kwargs, create_kwargs=None):
    """Fetch existing record or create it. Returns (instance, created: bool)."""
    obj = db.execute(
        select(model).filter_by(**filter_kwargs)
    ).scalar_one_or_none()
    if obj:
        return obj, False
    obj = model(**(filter_kwargs | (create_kwargs or {})))
    db.add(obj)
    db.flush()  # get generated id without committing
    return obj, True


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

def seed():
    db = SessionLocal()
    try:
        print("\n🌱 Iniciando seed...")

        # 1. Tipos de cultivo
        print("\n  📋 Tipos de cultivo:")
        for nombre in CROP_TYPES:
            _, created = get_or_create(db, CropType, {"nombre": nombre})
            print(f"    {'+ Creado' if created else '✓ Ya existe'}: {nombre}")

        # 2. Usuarios
        print("\n  👥 Usuarios:")
        user_map = {}  # correo -> User instance
        for u in USERS:
            user, created = get_or_create(
                db,
                User,
                {"correo": u["correo"]},
                {
                    "contrasena_hash": hash_password(u["password"]),
                    "nombre_completo": u["nombre"],
                    "rol": u["rol"],
                },
            )
            user_map[u["correo"]] = user
            print(f"    {'+ Creado' if created else '✓ Ya existe'}: {u['correo']} ({u['rol']})")

            # Crear registro de cliente para usuarios con rol 'cliente'
            if u["rol"] == "cliente":
                get_or_create(
                    db,
                    Client,
                    {"usuario_id": user.id},
                    {"nombre_empresa": u.get("empresa", u["nombre"])},
                )

        # 3. Jerarquía de prueba: Predio + Áreas + Nodos
        cliente_user = user_map["cliente@sensores.com"]
        cliente_record = db.execute(
            select(Client).where(Client.usuario_id == cliente_user.id)
        ).scalar_one()

        print("\n  🏡 Predio de prueba:")
        predio, created = get_or_create(
            db,
            Property,
            {"cliente_id": cliente_record.id, "nombre": "Rancho Norte"},
            {"ubicacion": "Sonora, México"},
        )
        print(f"    {'+ Creado' if created else '✓ Ya existe'}: Rancho Norte")

        print("\n  🌿 Áreas de riego y nodos:")
        for item in AREAS_Y_NODOS:
            # Obtener tipo de cultivo
            cultivo = db.execute(
                select(CropType).where(CropType.nombre == item["cultivo"])
            ).scalar_one()

            # Área de riego
            area, area_created = get_or_create(
                db,
                IrrigationArea,
                {"predio_id": predio.id, "nombre": item["area_nombre"]},
                {"tipo_cultivo_id": cultivo.id, "tamano_area": item["tamano"]},
            )
            print(f"    {'+ Creada' if area_created else '✓ Ya existe'}: {item['area_nombre']}")

            # Nodo
            node, node_created = get_or_create(
                db,
                Node,
                {"api_key": item["api_key"]},
                {
                    "area_riego_id": area.id,
                    "nombre": item["nodo_nombre"],
                    "latitud": item["lat"],
                    "longitud": item["lon"],
                    "activo": True,
                },
            )
            print(f"      {'+ Nodo creado' if node_created else '✓ Nodo ya existe'}: {item['nodo_nombre']}")

        db.commit()
        print("\n✅ Seed completado exitosamente.\n")
        print("  Credenciales de acceso:")
        print("    Admin:    admin@sensores.com     / admin123")
        print("    Cliente:  cliente@sensores.com   / cliente123")
        print("    Simulador (API Key Nogal Norte): 99189486-8181-4e8c-8c6d-b3da66e6712b\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error en seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
