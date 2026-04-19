# Guía de Testing — Backend IoT Sensores

Documentación completa de la suite de tests del sistema de Backend (FastAPI). Cubre la estrategia, infraestructura, cómo ejecutar, catálogos de tests y resultados de arquitectura.

---

## Tabla de Contenidos

1. [Estrategia de Testing](#estrategia-de-testing)
2. [Stack y Dependencias](#stack-y-dependencias)
3. [Cómo Ejecutar los Tests](#cómo-ejecutar-los-tests)
4. [Estructura de Archivos](#estructura-de-archivos)
5. [Fixtures Globales (conftest.py)](#fixtures-globales-conftestpy)
6. [Resumen de Ejecución y Cobertura](#resumen-de-ejecución-y-cobertura)

---

## Estrategia de Testing

La suite utiliza una **pirámide de dos niveles** orientada a la verificación de la API REST:

```text
          ┌──────────────────────────────────┐
          │   INTEGRACIÓN (13 módulos)       │  ← HTTP end-to-end con FastAPI TestClient
          │   Flujos reales: request→BD      │
          ├──────────────────────────────────┤
          │   UNITARIO (9 módulos)           │  ← Lógica de negocio aislada
          │   Servicios con BD en memoria    │
          └──────────────────────────────────┘
```

### Principios clave

| Principio | Implementación |
|-----------|---------------|
| **Sin dependencias externas** | Se utiliza SQLite en memoria (`sqlite:///:memory:`). No requiere MySQL ni Docker corriendo para pasar toda la suite de pruebas. |
| **Aislamiento entre tests** | Cada test utiliza transacciones envueltas con rollback automático al finalizar; estado limpio garantizado para cada función. |
| **Tests rápidos** | >280 tests se ejecutan en ~1 minuto. |
| **Fixtures reutilizables** | `conftest.py` centraliza la jerarquía completa de datos de prueba inyectables en cualquier endpoint. |

---

## Stack y Dependencias

Las dependencias de testing se instalan con el grupo `dev` en `pyproject.toml` (o a través de UV/pip):

```toml
[dependency-groups]
dev = [
    "httpx>=0.28.0",     # Transport async para TestClient de FastAPI
    "pytest>=8.3.0",     # Framework de testing principal
    "pytest-cov>=6.0.0", # Reportes de cobertura de código
]
```

---

## Cómo Ejecutar los Tests

Todos los comandos se corren desde el directorio `backend/`:

### Correr toda la suite
```bash
uv run pytest tests/ -v
```

### Con reporte de cobertura en terminal
```bash
uv run pytest tests/ --cov=app --cov-report=term-missing
```

### Con reporte HTML
Genera archivos estáticos explorables (abre `htmlcov/index.html` en el navegador).
```bash
uv run pytest tests/ --cov=app --cov-report=html:htmlcov
```

### Ejecuciones Sectorizadas
```bash
# Solo tests unitarios de servicios
uv run pytest tests/unit/ -v

# Solo tests de integración e2e
uv run pytest tests/integration/ -v

# Un test específico por nombre o keyword
uv run pytest tests/ -v -k "test_login_admin_success"

# Detener la ejecución al primer fallo detectado
uv run pytest tests/ -x
```

---

## Estructura de Archivos

```text
backend/
├── pyproject.toml           # Configuración pytest y coverage
└── tests/
    ├── __init__.py
    ├── conftest.py          # Fixtures globales: BD, TestClient, tokens, entidades default
    │
    ├── unit/                # Tests de la capa de servicios (lógica de negocio interna)
    │   ├── test_security.py           # Hash bcrypt, verificación JWT
    │   ├── test_user_service.py       # CRUD base de usuarios
    │   ├── test_client_service.py     # Lógica atómica de User+Client
    │   ├── test_reading_service.py    # Validación de inserción de sensores
    │   └── ... (servicios restantes de catálogos y jerarquías)
    │
    └── integration/         # Tests HTTP de red (Endpoints)
        ├── test_auth_api.py           # Rutas /auth (Tokens)
        ├── test_readings_api.py       # Peticiones tipo POST /readings (Simulator API)
        ├── test_users_api.py          # Rutas REST /users
        ├── test_permissions.py        # Comprobación de roles de seguridad (401/403)
        └── ... (routers restantes)
```

---

## Fixtures Globales (conftest.py)

La suite hace un uso exhaustivo de la inyección de dependencias de `pytest` (Fixtures) para mantener los tests libres de código *boilerplate* de inicialización. Por defecto mantienen un **scope por test** garantizando asilamiento total.

### Fixtures de Infraestructura

| Fixture | Tipo | Descripción |
|---------|------|-------------|
| `create_tables` | `session` | Crea el schema definido por SQLAlchemy una vez por sesión pytest. |
| `db` | `function` | Sesión activa con rollback al concluir la función de prueba. |
| `client` | `function` | Instancia interactiva de `TestClient` con sobreescritura implícita de `get_db()`. |

### Fixtures de Usuarios y Red

| Fixture | Devuelve | Uso Múltiple |
|---------|----------|--------------|
| `admin_user` / `client_user` | Registro instanciado de BD | Se puede usar para evaluar DB final o IDs directos. |
| `admin_token` / `client_token` | JWT literal en string | Para armar flujos paralelos de autenticación. |
| `admin_headers` / `client_headers` | Diccionario tipo HTTP | Se inserta directamente: `client.post(..., headers=admin_headers)` |
| `node_headers` | Diccionario secreto | Emula las `X-API-Key` interceptadas en middleware de dispositivos IoT. |

### Grafo de Entidades en Cascada (`sample_*`)
Si pides el fixture `sample_crop_cycle` en un test, el motor de pytest creará e insertará en cadena:
1. `User` (Cliente)
2. `Property` (Predio)
3. `CropType` (Catálogo)
4. `IrrigationArea` (Área de riego uniendo Predio+Cultivo)
5. `CropCycle` (Ciclo en sí mismo)

Esto hace que cada test de integración reciba datos preexistentes válidos en cuestión de milisegundos y con solo 1 línea de inclusión.

---

## Resumen de Ejecución y Cobertura

Validado en la fase regular de construcción del sistema, con cobertura de flujos positivos y restrictivos (404/401/422/409):

- **Total de Pruebas:** 282 passed
- **Modulos Evaluados:** 24 archivos de prueba (1 módulo de config, 13 de API, 10 de Unitaria)
- **Tasa de Éxito:** 100% de la suite.
- **Cobertura Promedio Transaccional:** >80% excluyendo modulos de migraciones `Alembic` y `Seed`. Se cubren validaciones Pydantic, restricciones de roles JWT y flujos SQL completos.
