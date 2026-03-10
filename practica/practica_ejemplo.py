"""
╔═══════════════════════════════════════════════════════════════╗
║  RESPUESTAS — Así debieron quedar tus ejercicios             ║
║  ─────────────────────────────────────────────────────────────║
║  Este archivo tiene los MISMOS ejercicios que                 ║
║  practica_ejercicios.py pero YA RESUELTOS.                   ║
║                                                               ║
║  Úsalo para comparar tu código cuando termines.              ║
║  ¡Intenta hacerlo tú primero antes de ver esto!              ║
║                                                               ║
║  Para correrlo:                                               ║
║    cd backend                                                 ║
║    uvicorn practica_ejemplo:app --reload --port 8000          ║
║                                                               ║
║  Para probarlo:                                               ║
║    Abre http://localhost:8000/docs en tu navegador            ║
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
# MODELOS (las mismas tablas que en practica_ejercicios.py)
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

app = FastAPI(title="Respuestas — CRUD Resuelto", version="1.0")


# ==========================================================
#  ┌─────────────────────────────────────┐
#  │   EJERCICIO 1 RESUELTO: PREDIOS     │
#  └─────────────────────────────────────┘
# ==========================================================


# ----------------------------------------------------------
# GET /predios → Listar todos
# ----------------------------------------------------------
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


# ----------------------------------------------------------
# GET /predios/{id} → Obtener uno por su ID
# ----------------------------------------------------------
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


# ----------------------------------------------------------
# POST /predios → Crear uno nuevo
# ----------------------------------------------------------
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


# ----------------------------------------------------------
# PUT /predios/{id} → Actualizar uno existente
# ----------------------------------------------------------
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


# ----------------------------------------------------------
# DELETE /predios/{id} → Eliminar (soft delete)
# ----------------------------------------------------------
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
#  │   EJERCICIO 2 RESUELTO: ÁREAS DE    │
#  │   RIEGO                             │
#  └─────────────────────────────────────┘
# ==========================================================


# ----------------------------------------------------------
# GET /areas-riego → Listar todas
# ----------------------------------------------------------
@app.get("/areas-riego")
def listar_areas_riego():
    db = Session()

    resultados = db.query(AreaRiego).filter(AreaRiego.eliminado_en == None).all()

    lista = []
    for area in resultados:
        lista.append(
            {
                "id": area.id,
                "predio_id": area.predio_id,
                "tipo_cultivo_id": area.tipo_cultivo_id,
                "nombre": area.nombre,
                "tamano_area": float(area.tamano_area) if area.tamano_area else None,
            }
        )

    db.close()
    return lista


# ----------------------------------------------------------
# GET /areas-riego/{id} → Obtener una
# ----------------------------------------------------------
@app.get("/areas-riego/{id}")
def obtener_area_riego(id: int):
    db = Session()

    area = (
        db.query(AreaRiego)
        .filter(
            AreaRiego.id == id,
            AreaRiego.eliminado_en == None,
        )
        .first()
    )

    db.close()

    if area is None:
        raise HTTPException(status_code=404, detail="Área de riego no encontrada")

    return {
        "id": area.id,
        "predio_id": area.predio_id,
        "tipo_cultivo_id": area.tipo_cultivo_id,
        "nombre": area.nombre,
        "tamano_area": float(area.tamano_area) if area.tamano_area else None,
    }


# ----------------------------------------------------------
# POST /areas-riego → Crear una nueva
# ----------------------------------------------------------
@app.post("/areas-riego")
def crear_area_riego(
    predio_id: int,
    tipo_cultivo_id: int,
    nombre: str,
    tamano_area: float = None,
):
    db = Session()

    nueva = AreaRiego(
        predio_id=predio_id,
        tipo_cultivo_id=tipo_cultivo_id,
        nombre=nombre,
        tamano_area=tamano_area,
    )

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    resultado = {
        "id": nueva.id,
        "predio_id": nueva.predio_id,
        "tipo_cultivo_id": nueva.tipo_cultivo_id,
        "nombre": nueva.nombre,
        "tamano_area": float(nueva.tamano_area) if nueva.tamano_area else None,
    }

    db.close()
    return resultado


# ----------------------------------------------------------
# PUT /areas-riego/{id} → Actualizar
# ----------------------------------------------------------
@app.put("/areas-riego/{id}")
def actualizar_area_riego(
    id: int,
    nombre: str = None,
    tamano_area: float = None,
):
    db = Session()

    area = (
        db.query(AreaRiego)
        .filter(
            AreaRiego.id == id,
            AreaRiego.eliminado_en == None,
        )
        .first()
    )

    if area is None:
        db.close()
        raise HTTPException(status_code=404, detail="Área de riego no encontrada")

    if nombre is not None:
        area.nombre = nombre
    if tamano_area is not None:
        area.tamano_area = tamano_area

    db.commit()
    db.refresh(area)

    resultado = {
        "id": area.id,
        "predio_id": area.predio_id,
        "tipo_cultivo_id": area.tipo_cultivo_id,
        "nombre": area.nombre,
        "tamano_area": float(area.tamano_area) if area.tamano_area else None,
    }

    db.close()
    return resultado


# ----------------------------------------------------------
# DELETE /areas-riego/{id} → Eliminar (soft delete)
# ----------------------------------------------------------
@app.delete("/areas-riego/{id}")
def eliminar_area_riego(id: int):
    db = Session()

    area = (
        db.query(AreaRiego)
        .filter(
            AreaRiego.id == id,
            AreaRiego.eliminado_en == None,
        )
        .first()
    )

    if area is None:
        db.close()
        raise HTTPException(status_code=404, detail="Área de riego no encontrada")

    area.eliminado_en = func.now()
    db.commit()
    db.close()

    return {"mensaje": f"Área de riego '{area.nombre}' eliminada"}


# ==========================================================
# ✅ RESUMEN — Todos los endpoints de este archivo:
# ==========================================================
#
#   PREDIOS:
#   GET    /predios              → Listar todos
#   GET    /predios/{id}         → Obtener uno
#   POST   /predios              → Crear nuevo
#   PUT    /predios/{id}         → Actualizar
#   DELETE /predios/{id}         → Eliminar
#
#   ÁREAS DE RIEGO:
#   GET    /areas-riego          → Listar todas
#   GET    /areas-riego/{id}     → Obtener una
#   POST   /areas-riego          → Crear nueva
#   PUT    /areas-riego/{id}     → Actualizar
#   DELETE /areas-riego/{id}     → Eliminar
#
# Total: 10 endpoints
# ==========================================================
