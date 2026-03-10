"""
╔═══════════════════════════════════════════════════════════════╗
║  EJERCICIOS — Crea tus endpoints CRUD                        ║
║  ─────────────────────────────────────────────────────────────║
║  La conexión a BD y los modelos ya están listos.              ║
║  Tu trabajo: crear los endpoints donde dice TODO.             ║
║                                                               ║
║  Referencia: mira practica_ejemplo.py para ver cómo se hace  ║
║                                                               ║
║  Para correrlo:                                               ║
║    cd backend                                                 ║
║    uvicorn practica_ejercicios:app --reload --port 8001       ║
║                                                               ║
║  Para probarlo:                                               ║
║    Abre http://localhost:8001/docs en tu navegador            ║
╚═══════════════════════════════════════════════════════════════╝
"""

import os

from fastapi import FastAPI, HTTPException
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    DECIMAL,
    func,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# ==========================================================
# CONEXIÓN A LA BASE DE DATOS
# ==========================================================
# ⚠️ Si tu MySQL tiene otra contraseña, cámbiala aquí:
#    Docker del proyecto → root:rootpass
#    MySQL local sin password → root:
#    En Codespaces no toques nada, ya funciona solo.

DB_HOST = os.getenv("DB_HOST", "localhost")
engine = create_engine(f"mysql+pymysql://root:rootpass@{DB_HOST}:3306/sensores_riego")
Session = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


# ==========================================================
# MODELOS (ya están listos, no tocar)
# ==========================================================


class Predio(Base):
    __tablename__ = "predios"

    id = Column(Integer, primary_key=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    nombre = Column(String(150))
    ubicacion = Column(String(255))
    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())
    eliminado_en = Column(DateTime, nullable=True)


class AreaRiego(Base):
    __tablename__ = "areas_riego"

    id = Column(Integer, primary_key=True)
    predio_id = Column(Integer, ForeignKey("predios.id"))
    tipo_cultivo_id = Column(Integer, ForeignKey("tipos_cultivo.id"))
    nombre = Column(String(150))
    tamano_area = Column(DECIMAL(10, 2))
    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())
    eliminado_en = Column(DateTime, nullable=True)


# ==========================================================
# APP
# ==========================================================
app = FastAPI(title="Ejercicios — CRUD", version="1.0")


# ==========================================================
#  ┌─────────────────────────────────────┐
#  │  EJERCICIO 1: CRUD DE PREDIOS       │
#  └─────────────────────────────────────┘
#
#  Tabla: predios
#  Campos para devolver: id, cliente_id, nombre, ubicacion
#  Campos para crear/editar: cliente_id, nombre, ubicacion
#
#  Crea 5 endpoints:
#    GET    /predios          → listar todos
#    GET    /predios/{id}     → obtener uno
#    POST   /predios          → crear nuevo
#    PUT    /predios/{id}     → actualizar
#    DELETE /predios/{id}     → eliminar (soft delete)
#
#  Tips:
#    - cliente_id es obligatorio al crear (es Integer)
#    - ubicacion es opcional (puede ser None)
#    - SIEMPRE filtra: .filter(Predio.eliminado_en == None)
# ==========================================================


# TODO: GET /predios — Listar todos los predios
@app.get("/predios")
def listar_predios():
    db = Session()

    resultados = db.query(Predio).filter(Predio.eliminado_en == None).all()

    lista = []
    for predio in resultados:
        lista.append(
            {
                "id": predio.id,
                "cliente_id": predio.cliente_id,
                "nombre": predio.nombre,
                "ubicacion": predio.ubicacion,
            }
        )

    db.close()
    return lista


# TODO: GET /predios/{id} — Obtener un predio por su ID
@app.get("/predios/{id}")
def obtener_predio(id: int):
    db = Session()

    predio = (
        db.query(Predio)
        .filter(
            Predio.id == id,
            Predio.eliminado_en == None,
        )
        .first()
    )

    db.close()

    if predio is None:
        raise HTTPException(status_code=404, detail="Predio no encontrado")

    return {
        "id": predio.id,
        "cliente_id": predio.cliente_id,
        "nombre": predio.nombre,
        "ubicacion": predio.ubicacion,
    }


# TODO: POST /predios — Crear un predio nuevo
@app.post("/predios")
def crear_predio(cliente_id: int, nombre: str, ubicacion: str = None):
    db = Session()

    nuevo = Predio(
        cliente_id=cliente_id,
        nombre=nombre,
        ubicacion=ubicacion,
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    resultado = {
        "id": nuevo.id,
        "cliente_id": nuevo.cliente_id,
        "nombre": nuevo.nombre,
        "ubicacion": nuevo.ubicacion,
    }

    db.close()
    return resultado


# TODO: PUT /predios/{id} — Actualizar un predio
@app.put("/predios/{id}")
def actualizar_predio(id: int, nombre: str = None, ubicacion: str = None):
    db = Session()

    predio = (
        db.query(Predio)
        .filter(
            Predio.id == id,
            Predio.eliminado_en == None,
        )
        .first()
    )

    if predio is None:
        db.close()
        raise HTTPException(status_code=404, detail="Predio no encontrado")

    if nombre is not None:
        predio.nombre = nombre
    if ubicacion is not None:
        predio.ubicacion = ubicacion

    db.commit()
    db.refresh(predio)

    resultado = {
        "id": predio.id,
        "cliente_id": predio.cliente_id,
        "nombre": predio.nombre,
        "ubicacion": predio.ubicacion,
    }

    db.close()
    return resultado


# TODO: DELETE /predios/{id} — Eliminar un predio (soft delete)
@app.delete("/predios/{id}")
def eliminar_predio(id: int):
    db = Session()

    predio = (
        db.query(Predio)
        .filter(
            Predio.id == id,
            Predio.eliminado_en == None,
        )
        .first()
    )

    if predio is None:
        db.close()
        raise HTTPException(status_code=404, detail="Predio no encontrado")

    predio.eliminado_en = func.now()
    db.commit()
    db.close()

    return {"mensaje": f"Predio '{predio.nombre}' eliminado"}


# ==========================================================
#  ┌─────────────────────────────────────┐
#  │  EJERCICIO 2: CRUD DE ÁREAS DE      │
#  │  RIEGO                              │
#  └─────────────────────────────────────┘
#
#  Tabla: areas_riego
#  Campos para devolver: id, predio_id, tipo_cultivo_id,
#                        nombre, tamano_area
#  Campos para crear: predio_id, tipo_cultivo_id, nombre,
#                     tamano_area (opcional)
#
#  Crea 5 endpoints:
#    GET    /areas-riego          → listar todas
#    GET    /areas-riego/{id}     → obtener una
#    POST   /areas-riego          → crear nueva
#    PUT    /areas-riego/{id}     → actualizar
#    DELETE /areas-riego/{id}     → eliminar (soft delete)
#
#  Tips:
#    - predio_id y tipo_cultivo_id son obligatorios al crear
#    - tamano_area es un número decimal (float en Python)
#    - tamano_area es opcional (puede ser None)
#    - SIEMPRE filtra: .filter(AreaRiego.eliminado_en == None)
# ==========================================================


# TODO: GET /areas-riego — Listar todas
@app.get("/areas-riego")
def listar_areas_riego():
    pass


# TODO: GET /areas-riego/{id} — Obtener una
@app.get("/areas-riego/{id}")
def obtener_area_riego(id: int):
    pass


# TODO: POST /areas-riego — Crear una nueva
@app.post("/areas-riego")
def crear_area_riego(
    predio_id: int,
    tipo_cultivo_id: int,
    nombre: str,
    tamano_area: float = None,
):
    pass


# TODO: PUT /areas-riego/{id} — Actualizar
@app.put("/areas-riego/{id}")
def actualizar_area_riego(
    id: int,
    nombre: str = None,
    tamano_area: float = None,
):
    pass


# TODO: DELETE /areas-riego/{id} — Eliminar (soft delete)
@app.delete("/areas-riego/{id}")
def eliminar_area_riego(id: int):
    pass


# ==========================================================
# 🏁 CUANDO TERMINES deberías tener 10 endpoints funcionando.
#    Abre http://localhost:8001/docs y prueba cada uno.
#
#    ¿No funciona? Revisa practica_ejemplo.py para
#    comparar el patrón.
# ==========================================================
