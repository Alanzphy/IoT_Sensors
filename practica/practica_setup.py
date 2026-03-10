"""
╔═══════════════════════════════════════════════════════════════╗
║  SETUP — Preparar la base de datos para los ejercicios       ║
║  ─────────────────────────────────────────────────────────────║
║  Ejecuta esto UNA SOLA VEZ antes de empezar los ejercicios.  ║
║  Crea las tablas necesarias y agrega datos de prueba.         ║
║                                                               ║
║  Cómo usarlo:                                                 ║
║    cd backend                                                 ║
║    python practica_setup.py                                   ║
╚═══════════════════════════════════════════════════════════════╝
"""

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Boolean,
    Enum,
    ForeignKey,
    DECIMAL,
    func,
    inspect,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ──────────────────────────────────────────────────────────────
# ⚠️ CAMBIA ESTO SI TU MySQL TIENE OTRA CONTRASEÑA
# ──────────────────────────────────────────────────────────────
# Si usaste Docker Compose del proyecto:  root:rootpass
# Si instalaste MySQL local sin password: root:
# En Codespaces no toques nada, ya funciona solo.

import os

DB_HOST = os.getenv("DB_HOST", "localhost")
CONEXION = f"mysql+pymysql://root:rootpass@{DB_HOST}:3306/sensores_riego"
# ──────────────────────────────────────────────────────────────


engine = create_engine(CONEXION)
Session = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


# ==============================================================
# MODELOS — Las tablas que se van a crear
# ==============================================================
# Necesitamos crear 5 tablas porque tienen dependencias (FK):
#   usuarios → clientes → predios → areas_riego
#                               ↗
#              tipos_cultivo ──┘


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    correo = Column(String(255), unique=True, nullable=False)
    contrasena_hash = Column(String(255), nullable=False)
    nombre_completo = Column(String(150), nullable=False)
    rol = Column(Enum("admin", "cliente", name="rol_enum"), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime, server_default=func.now(), nullable=False)
    eliminado_en = Column(DateTime, nullable=True)


class TipoCultivo(Base):
    __tablename__ = "tipos_cultivo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime, server_default=func.now(), nullable=False)
    eliminado_en = Column(DateTime, nullable=True)


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True, nullable=False)
    nombre_empresa = Column(String(200), nullable=False)
    telefono = Column(String(30), nullable=True)
    direccion = Column(Text, nullable=True)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime, server_default=func.now(), nullable=False)
    eliminado_en = Column(DateTime, nullable=True)


class Predio(Base):
    __tablename__ = "predios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    nombre = Column(String(150), nullable=False)
    ubicacion = Column(String(255), nullable=True)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime, server_default=func.now(), nullable=False)
    eliminado_en = Column(DateTime, nullable=True)


class AreaRiego(Base):
    __tablename__ = "areas_riego"

    id = Column(Integer, primary_key=True, autoincrement=True)
    predio_id = Column(Integer, ForeignKey("predios.id"), nullable=False)
    tipo_cultivo_id = Column(Integer, ForeignKey("tipos_cultivo.id"), nullable=False)
    nombre = Column(String(150), nullable=False)
    tamano_area = Column(DECIMAL(10, 2), nullable=True)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime, server_default=func.now(), nullable=False)
    eliminado_en = Column(DateTime, nullable=True)


# ==============================================================
# MAIN — Crear tablas e insertar datos de prueba
# ==============================================================


def main():
    print("=" * 55)
    print("  SETUP DE BASE DE DATOS PARA EJERCICIOS")
    print("=" * 55)
    print()

    # ------- Verificar conexión -------
    print("1. Conectando a MySQL...")
    try:
        with engine.connect() as conn:
            conn.execute(func.now().select())
        print("   ✅ Conexión exitosa\n")
    except Exception as e:
        print(f"   ❌ Error de conexión: {e}")
        print()
        print("   Verifica que:")
        print("   - MySQL esté corriendo (docker compose up -d mysql)")
        print("   - La contraseña sea correcta en la variable CONEXION")
        print("     de este archivo (línea ~42)")
        return

    # ------- Crear tablas -------
    print("2. Creando tablas...")
    inspector = inspect(engine)
    tablas_existentes = inspector.get_table_names()

    tablas_necesarias = [
        "usuarios",
        "tipos_cultivo",
        "clientes",
        "predios",
        "areas_riego",
    ]

    ya_existen = [t for t in tablas_necesarias if t in tablas_existentes]
    faltan = [t for t in tablas_necesarias if t not in tablas_existentes]

    if ya_existen:
        print(f"   → Ya existían: {', '.join(ya_existen)}")
    if faltan:
        print(f"   → Creando: {', '.join(faltan)}")

    Base.metadata.create_all(engine)
    print("   ✅ Tablas listas\n")

    # ------- Datos de prueba -------
    print("3. Insertando datos de prueba...")
    db = Session()

    try:
        # Verificar si ya hay datos
        if db.query(Usuario).count() > 0:
            print("   → Ya hay datos en la BD, no se insertan duplicados.")
            print("   ✅ Listo\n")
            return

        # Usuario cliente de prueba
        usuario = Usuario(
            correo="cliente@test.com",
            contrasena_hash="no-importa-para-la-practica",
            nombre_completo="Juan Pérez",
            rol="cliente",
            activo=True,
        )
        db.add(usuario)
        db.flush()  # para obtener el ID
        print(f"   + Usuario: {usuario.correo} (id={usuario.id})")

        # Cliente
        cliente = Cliente(
            usuario_id=usuario.id,
            nombre_empresa="Agrícola del Norte",
            telefono="614-555-0001",
            direccion="Chihuahua, México",
        )
        db.add(cliente)
        db.flush()
        print(f"   + Cliente: {cliente.nombre_empresa} (id={cliente.id})")

        # Tipos de cultivo
        cultivos = ["Nogal", "Alfalfa", "Manzana", "Maíz", "Chile", "Algodón"]
        ids_cultivo = []
        for nombre in cultivos:
            tc = TipoCultivo(nombre=nombre)
            db.add(tc)
            db.flush()
            ids_cultivo.append(tc.id)
            print(f"   + Tipo cultivo: {nombre} (id={tc.id})")

        # Predios
        predios_data = [
            ("Rancho San Miguel", "Delicias, Chihuahua"),
            ("Parcela El Vergel", "Meoqui, Chihuahua"),
        ]
        ids_predio = []
        for nombre, ubicacion in predios_data:
            p = Predio(
                cliente_id=cliente.id,
                nombre=nombre,
                ubicacion=ubicacion,
            )
            db.add(p)
            db.flush()
            ids_predio.append(p.id)
            print(f"   + Predio: {nombre} (id={p.id})")

        # Áreas de riego
        areas_data = [
            (ids_predio[0], ids_cultivo[0], "Nogal Norte", 15.50),
            (ids_predio[0], ids_cultivo[1], "Alfalfa Sur", 8.00),
            (ids_predio[1], ids_cultivo[3], "Maíz Principal", 20.00),
        ]
        for predio_id, tipo_id, nombre, tamano in areas_data:
            ar = AreaRiego(
                predio_id=predio_id,
                tipo_cultivo_id=tipo_id,
                nombre=nombre,
                tamano_area=tamano,
            )
            db.add(ar)
            db.flush()
            print(f"   + Área de riego: {nombre} (id={ar.id})")

        db.commit()
        print("   ✅ Datos de prueba insertados\n")

    except Exception as e:
        db.rollback()
        print(f"   ❌ Error: {e}\n")
    finally:
        db.close()

    # ------- Resumen -------
    print("=" * 55)
    print("  ¡TODO LISTO!")
    print("=" * 55)
    print()
    print("  Datos disponibles para tus ejercicios:")
    print("  ─────────────────────────────────────")
    print("  • 1 cliente  (id=1) → úsalo como cliente_id")
    print("  • 6 tipos de cultivo (id=1..6)")
    print("  • 2 predios  (id=1,2)")
    print("  • 3 áreas de riego (id=1,2,3)")
    print()
    print("  Ahora corre los ejercicios:")
    print("  uvicorn practica_ejercicios:app --reload --port 8001")
    print()


if __name__ == "__main__":
    main()
