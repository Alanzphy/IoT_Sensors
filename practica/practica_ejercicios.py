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
    # 1. Abre la sesión de BD:       db = Session()
    # 2. Consulta todos los predios no eliminados:
    #    resultados = db.query(Predio).filter(Predio.eliminado_en == None).all()
    # 3. Convierte cada uno a diccionario con: id, cliente_id, nombre, ubicacion
    # 4. Cierra la sesión:            db.close()
    # 5. Devuelve la lista
    pass  # ← borra esto y escribe tu código


# TODO: GET /predios/{id} — Obtener un predio por su ID
@app.get("/predios/{id}")
def obtener_predio(id: int):
    # 1. Abre la sesión
    # 2. Busca el predio por id (y que no esté eliminado)
    #    usa .first() en vez de .all()
    # 3. Cierra la sesión
    # 4. Si no existe → raise HTTPException(status_code=404, detail="...")
    # 5. Devuelve el diccionario con: id, cliente_id, nombre, ubicacion
    pass


# TODO: POST /predios — Crear un predio nuevo
@app.post("/predios")
def crear_predio(cliente_id: int, nombre: str, ubicacion: str = None):
    # 1. Abre la sesión
    # 2. Crea el objeto:  nuevo = Predio(cliente_id=..., nombre=..., ubicacion=...)
    # 3. db.add(nuevo)
    # 4. db.commit()
    # 5. db.refresh(nuevo)
    # 6. Arma el diccionario resultado
    # 7. db.close()
    # 8. Devuelve el resultado
    pass


# TODO: PUT /predios/{id} — Actualizar un predio
@app.put("/predios/{id}")
def actualizar_predio(id: int, nombre: str = None, ubicacion: str = None):
    # 1. Busca el predio (como en obtener_predio)
    # 2. Si no existe → 404
    # 3. Si nombre fue enviado (is not None) → predio.nombre = nombre
    # 4. Si ubicacion fue enviado → predio.ubicacion = ubicacion
    # 5. db.commit() + db.refresh(predio)
    # 6. Devuelve el resultado
    pass


# TODO: DELETE /predios/{id} — Eliminar un predio (soft delete)
@app.delete("/predios/{id}")
def eliminar_predio(id: int):
    # 1. Busca el predio
    # 2. Si no existe → 404
    # 3. predio.eliminado_en = func.now()
    # 4. db.commit()
    # 5. db.close()
    # 6. Devuelve: {"mensaje": f"Predio '{predio.nombre}' eliminado"}
    pass


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
