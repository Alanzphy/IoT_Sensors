"""Seed initial data: 6 crop types + 1 admin user."""

import bcrypt
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.crop_type import CropType
from app.models.user import User

CROP_TYPES = ["Nogal", "Alfalfa", "Manzana", "Maíz", "Chile", "Algodón"]

ADMIN_EMAIL = "admin@sensores.com"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME = "Administrador"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed():
    db = SessionLocal()
    try:
        # Seed crop types
        for name in CROP_TYPES:
            exists = db.execute(
                select(CropType).where(CropType.nombre == name)
            ).scalar_one_or_none()
            if not exists:
                db.add(CropType(nombre=name))
                print(f"  + Tipo de cultivo: {name}")

        # Seed admin user
        admin = db.execute(
            select(User).where(User.correo == ADMIN_EMAIL)
        ).scalar_one_or_none()
        if not admin:
            db.add(
                User(
                    correo=ADMIN_EMAIL,
                    contrasena_hash=hash_password(ADMIN_PASSWORD),
                    nombre_completo=ADMIN_NAME,
                    rol="admin",
                )
            )
            print(f"  + Usuario admin: {ADMIN_EMAIL}")

        db.commit()
        print("Seed completado.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
