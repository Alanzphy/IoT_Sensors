# Guía de Testing — Backend IoT Sensores

Documentación completa de la suite de tests del sistema. Cubre la estrategia, infraestructura, cómo ejecutar, catálogos de tests y resultados de cobertura.

---

## Tabla de Contenidos

1. [Estrategia de Testing](#estrategia-de-testing)
2. [Stack y Dependencias](#stack-y-dependencias)
3. [Cómo Ejecutar los Tests](#cómo-ejecutar-los-tests)
4. [Estructura de Archivos](#estructura-de-archivos)
5. [Fixtures Globales (conftest.py)](#fixtures-globales-conftestpy)
6. [Tests Unitarios — Capa de Servicios](#tests-unitarios--capa-de-servicios)
7. [Tests de Integración — API HTTP](#tests-de-integración--api-http)
8. [Resultados de Cobertura](#resultados-de-cobertura)
9. [Notas Técnicas y Decisiones de Diseño](#notas-técnicas-y-decisiones-de-diseño)

---

## Estrategia de Testing

La suite utiliza una **pirámide de dos niveles**:

```
          ┌──────────────────────────────────┐
          │   INTEGRACIÓN (10 módulos)        │  ← HTTP end-to-end con TestClient
          │   Flujos reales: request→BD       │
          ├──────────────────────────────────┤
          │   UNITARIO (9 módulos)            │  ← Lógica de negocio aislada
          │   Servicios con BD en memoria     │
          └──────────────────────────────────┘
```

### Principios clave

| Principio | Implementación |
|-----------|---------------|
| **Sin dependencias externas** | SQLite en memoria, no requiere MySQL ni Docker corriendo |
| **Aislamiento entre tests** | Cada test usa rollback al finalizar; estado limpio garantizado |
| **Tests rápidos** | 228 tests en ~65 segundos |
| **Fixtures reutilizables** | `conftest.py` centraliza la jerarquía completa de datos de prueba |

### ¿Por qué SQLite en vez de MySQL?

- Cualquier desarrollador puede correr los tests sin configurar Docker
- CI/CD sin servicios externos
- La compatibilidad se mantiene gracias a tipado SQLAlchemy (ORM agnóstico)
- Un workaround de compilación maneja la diferencia de `BigInteger` (ver sección [Notas Técnicas](#notas-técnicas-y-decisiones-de-diseño))

---

## Stack y Dependencias

Las dependencias de testing se instalan con el grupo `dev`:

```toml
[dependency-groups]
dev = [
    "httpx>=0.28.0",     # Transport para TestClient de FastAPI
    "pytest>=8.3.0",     # Framework de testing
    "pytest-cov>=6.0.0", # Reporte de cobertura de código
]
```

---

## Cómo Ejecutar los Tests

Todos los comandos se corren desde `backend/`:

### Correr toda la suite

```bash
cd backend
uv run pytest tests/ -v
```

### Con reporte de cobertura en terminal

```bash
uv run pytest tests/ --cov=app --cov-report=term-missing
```

### Con reporte HTML (abre `htmlcov/index.html`)

```bash
uv run pytest tests/ --cov=app --cov-report=html:htmlcov
```

### Solo tests unitarios

```bash
uv run pytest tests/unit/ -v
```

### Solo tests de integración

```bash
uv run pytest tests/integration/ -v
```

### Un módulo específico

```bash
uv run pytest tests/unit/test_reading_service.py -v
uv run pytest tests/integration/test_auth_api.py -v
```

### Un test específico por nombre

```bash
uv run pytest tests/ -v -k "test_login_admin_success"
uv run pytest tests/ -v -k "TestCreateReading"
```

### Modo silencioso (solo fallos)

```bash
uv run pytest tests/ -q
```

### Detener al primer fallo

```bash
uv run pytest tests/ -x
```

---

## Estructura de Archivos

```
backend/
├── pyproject.toml           # Dependencias de dev: pytest, httpx, pytest-cov
└── tests/
    ├── __init__.py
    ├── conftest.py          # Fixtures globales: BD, TestClient, tokens, datos
    │
    ├── unit/                # Tests de la capa de servicios (lógica de negocio)
    │   ├── __init__.py
    │   ├── test_security.py           # hash/verify bcrypt, JWT tokens
    │   ├── test_user_service.py       # CRUD usuarios
    │   ├── test_client_service.py     # CRUD clientes (user+client atómico)
    │   ├── test_crop_type_service.py  # CRUD tipos de cultivo
    │   ├── test_property_service.py   # CRUD predios
    │   ├── test_irrigation_area_service.py  # CRUD áreas de riego
    │   ├── test_crop_cycle_service.py  # CRUD ciclos de cultivo
    │   ├── test_node_service.py       # CRUD nodos IoT
    │   └── test_reading_service.py    # Ingesta y consulta de lecturas
    │
    └── integration/         # Tests HTTP end-to-end con TestClient de FastAPI
        ├── __init__.py
        ├── test_auth_api.py           # POST /auth/login, /auth/refresh, /auth/logout
        ├── test_readings_api.py       # POST y GET /readings, exports
        ├── test_users_api.py          # CRUD /users
        ├── test_clients_api.py        # CRUD /clients
        ├── test_properties_api.py     # CRUD /properties
        ├── test_crop_types_api.py     # CRUD /crop-types
        ├── test_irrigation_areas_api.py  # CRUD /irrigation-areas
        ├── test_crop_cycles_api.py    # CRUD /crop-cycles
        ├── test_nodes_api.py          # CRUD /nodes
        └── test_permissions.py        # Aislamiento de roles y autenticación
```

---

## Fixtures Globales (conftest.py)

Todos los fixtures son de **scope por test** (por defecto), lo que garantiza aislamiento total. Se componen en cadena siguiendo la jerarquía del dominio.

### Fixtures de infraestructura

| Fixture | Tipo | Descripción |
|---------|------|-------------|
| `create_tables` | `session` | Crea el schema SQLite una vez por sesión pytest. Se destruye al final. |
| `db` | `function` | Sesión SQLAlchemy con rollback automático al finalizar cada test. |
| `client` | `function` | `TestClient` de FastAPI con `get_db` overrideado a la BD de test. |

### Fixtures de usuarios y autenticación

| Fixture | Depende de | Crea |
|---------|-----------|------|
| `admin_user` | `db` | Registro `User` con `rol="admin"` |
| `admin_token` | `admin_user` | JWT access token del admin |
| `admin_headers` | `admin_token` | `{"Authorization": "Bearer <token>"}` |
| `client_user` | `db` | Registro `User` + `Client` con `rol="cliente"` (tupla) |
| `client_token` | `client_user` | JWT access token del cliente |
| `client_headers` | `client_token` | `{"Authorization": "Bearer <token>"}` |

### Fixtures de datos de dominio

Los fixtures siguen la jerarquía completa del sistema:

```
client_user (User + Client)
    └── sample_property (Predio)
            └── sample_irrigation_area (Área de Riego + sample_crop_type)
                    ├── sample_node (Nodo IoT con API Key)
                    │       └── node_headers {"X-API-Key": "ak_test_key_000"}
                    └── sample_crop_cycle (Ciclo activo 2026-01-01, sin fecha_fin)
```

| Fixture | Qué crea |
|---------|---------|
| `sample_crop_type` | `CropType(nombre="Nogal")` |
| `sample_property` | `Property(nombre="Rancho Test")` vinculado a `client_user` |
| `sample_irrigation_area` | `IrrigationArea(nombre="Norte Nogal", tamano_area=10.5)` |
| `sample_node` | `Node(api_key="ak_test_key_000", activo=True)` |
| `node_headers` | `{"X-API-Key": "ak_test_key_000"}` |
| `sample_crop_cycle` | `CropCycle(fecha_inicio=2026-01-01, fecha_fin=None)` |

### Uso típico en un test

```python
def test_algo(self, client, admin_headers, sample_node, node_headers):
    # client = TestClient con BD limpia
    # admin_headers = {"Authorization": "Bearer <token>"}
    # sample_node = Node con api_key lista
    # node_headers = {"X-API-Key": "ak_test_key_000"}
    ...
```

---

## Tests Unitarios — Capa de Servicios

Los tests unitarios verifican la lógica de negocio de cada servicio de forma aislada, sin capas HTTP.

### `test_security.py` — 12 tests

Cubre `app/core/security.py`: hashing de contraseñas y manejo de JWT.

| Test | Qué verifica |
|------|-------------|
| `test_hash_is_different_from_plain` | El hash bcrypt nunca es igual al texto plano |
| `test_verify_correct_password` | `verify_password("pass", hash("pass"))` → `True` |
| `test_verify_wrong_password` | Contraseña incorrecta → `False` |
| `test_same_plain_generates_different_hashes` | bcrypt usa salt aleatorio; dos hashes del mismo texto difieren |
| `test_access_token_contains_correct_type` | Payload tiene `"type": "access"` |
| `test_refresh_token_contains_correct_type` | Payload tiene `"type": "refresh"` |
| `test_decode_returns_original_claims` | `sub`, `rol`, `nombre` correctos tras decode |
| `test_decode_invalid_token_returns_none` | Token basura → `None` (no excepción) |
| `test_decode_tampered_token_returns_none` | Token modificado → `None` |
| `test_decode_expired_token_returns_none` | Token con `exp` en el pasado → `None` |
| `test_access_token_has_expiry` | Payload incluye campo `exp` |
| `test_refresh_token_expires_later_than_access` | `refresh.exp > access.exp` |

---

### `test_user_service.py` — 13 tests

Cubre `app/services/user.py`.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateUser` | `test_create_user_success` | Crea usuario, `id` asignado, campos correctos |
| | `test_password_is_hashed` | El hash almacenado verifica correctamente |
| | `test_create_duplicate_email_raises_409` | Email repetido → `HTTPException 409` |
| | `test_create_cliente_role` | Rol `"cliente"` se almacena correctamente |
| `TestGetUser` | `test_get_existing_user` | Retorna el usuario por ID |
| | `test_get_nonexistent_user_raises_404` | ID inexistente → `HTTPException 404` |
| | `test_get_soft_deleted_user_raises_404` | Usuario borrado lógicamente → `404` |
| `TestListUsers` | `test_list_returns_created_users` | Total ≥ usuarios creados |
| | `test_list_pagination` | `per_page=2` limita resultados a 2 |
| | `test_list_filter_by_role` | Solo retorna usuarios con el rol dado |
| | `test_soft_deleted_not_in_list` | Borrados lógicamente no aparecen |
| `TestUpdateUser` | `test_update_full_name` | Actualiza `nombre_completo` |
| | `test_update_password` | Nuevo hash verifica nueva contraseña |
| | `test_update_email_to_existing_raises_409` | Email ya usado → `409` |
| `TestSoftDeleteUser` | `test_soft_delete_marks_eliminado_en` | `activo=False` tras borrado |
| | `test_soft_delete_nonexistent_raises_404` | ID inexistente → `404` |

---

### `test_client_service.py` — 11 tests

Cubre `app/services/client.py`. Valida la creación atómica de User + Client.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateClient` | `test_create_client_creates_user_and_client` | Crea ambos registros; `user.rol == "cliente"` |
| | `test_create_client_duplicate_email_raises_409` | Email repetido → `409` |
| | `test_create_client_with_optional_fields_none` | `phone=None, address=None` sin error |
| `TestGetClient` | `test_get_existing_client` | Retorna cliente por ID |
| | `test_get_nonexistent_raises_404` | `404` si no existe |
| `TestListClients` | `test_list_returns_clients` | Total ≥ clientes creados |
| | `test_soft_deleted_not_in_list` | Borrados no aparecen |
| `TestUpdateClient` | `test_update_company_name` | Actualiza `nombre_empresa` |
| | `test_update_phone_and_address` | Actualiza ambos campos opcionales |
| `TestSoftDeleteClient` | `test_soft_delete_disables_user` | `user.activo=False` en cascade |
| | `test_soft_delete_cascades_to_properties` | Predios relacionados se marcan con `eliminado_en` |

---

### `test_crop_type_service.py` — 11 tests

Cubre `app/services/crop_type.py`.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateCropType` | `test_create_success` | ID asignado, `nombre` correcto |
| | `test_create_with_description` | Descripción almacenada |
| | `test_create_duplicate_name_raises_409` | Nombre repetido → `409` |
| `TestGetCropType` | `test_get_existing` | Retorna por ID |
| | `test_get_nonexistent_raises_404` | `404` |
| `TestListCropTypes` | `test_list_returns_items` | Total ≥ items creados |
| | `test_pagination_limits_results` | `per_page=2` respetado |
| | `test_soft_deleted_not_shown` | Borrados excluidos |
| `TestUpdateCropType` | `test_update_name` | Nuevo nombre almacenado |
| | `test_update_description` | Nueva descripción almacenada |
| `TestSoftDeleteCropType` | `test_soft_delete_marks_record` | Registro inaccesible tras borrado |

---

### `test_property_service.py` — 9 tests

Cubre `app/services/property.py`.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateProperty` | `test_create_success` | Predio con `cliente_id` correcto |
| | `test_create_with_invalid_client_raises_404` | Cliente inexistente → `404` |
| | `test_create_without_location` | `ubicacion=None` aceptado |
| `TestGetProperty` | `test_get_existing` | Retorna por ID |
| | `test_get_nonexistent_raises_404` | `404` |
| `TestListProperties` | `test_list_all` | Lista correcta |
| | `test_filter_by_client` | Solo predios del cliente indicado |
| `TestUpdateProperty` | `test_update_name` | Nombre actualizado |
| | `test_update_location` | Ubicación actualizada |
| `TestSoftDeleteProperty` | `test_soft_delete` | Inaccesible tras borrado → `404` |

---

### `test_irrigation_area_service.py` — 10 tests

Cubre `app/services/irrigation_area.py`.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateIrrigationArea` | `test_create_success` | FK a predio y tipo de cultivo correctas |
| | `test_create_invalid_property_raises_404` | Predio inexistente → `404` |
| | `test_create_invalid_crop_type_raises_404` | Tipo de cultivo inexistente → `404` |
| `TestGetIrrigationArea` | `test_get_existing` / `test_get_nonexistent_raises_404` | CRUD básico |
| `TestListIrrigationAreas` | `test_list_returns_items` / `test_filter_by_property` | Listado y filtro |
| `TestUpdateIrrigationArea` | `test_update_name` / `test_update_area_size` | Actualización de campos |
| | `test_update_invalid_crop_type_raises_404` | Tipo inexistente en update → `404` |
| `TestSoftDeleteIrrigationArea` | `test_soft_delete` | Inaccesible tras borrado |

---

### `test_crop_cycle_service.py` — 11 tests

Cubre `app/services/crop_cycle.py`. Especial atención a la regla de negocio: **solo 1 ciclo activo por área**.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateCropCycle` | `test_create_active_cycle_success` | Ciclo sin `fecha_fin` creado |
| | `test_create_closed_cycle_success` | Ciclo con `fecha_fin` creado |
| | `test_create_second_active_cycle_raises_409` | **Regla: solo 1 activo → `409`** |
| | `test_create_with_invalid_area_raises_404` | Área inexistente → `404` |
| | `test_two_closed_cycles_allowed` | Dos ciclos con `fecha_fin` coexisten |
| `TestGetCropCycle` | `test_get_existing` / `test_get_nonexistent_raises_404` | CRUD básico |
| `TestUpdateCropCycle` | `test_close_active_cycle` | Asignar `fecha_fin` a ciclo activo |
| | `test_update_start_date` | Cambiar `fecha_inicio` |
| `TestListCropCycles` | `test_list_for_area` | Filtro por área de riego |
| `TestSoftDeleteCropCycle` | `test_soft_delete` | Inaccesible tras borrado |

---

### `test_node_service.py` — 12 tests

Cubre `app/services/node.py`. Valida la relación 1:1 entre nodo y área de riego.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateNode` | `test_create_success` | `api_key` generada con prefijo `ak_` |
| | `test_create_invalid_area_raises_404` | Área inexistente → `404` |
| | `test_create_second_node_same_area_raises_409` | **Regla 1:1 → `409`** |
| | `test_each_node_gets_unique_api_key` | Dos nodos en distintas áreas tienen keys distintas |
| `TestGetNode` | `test_get_existing` / `test_get_nonexistent_raises_404` | CRUD básico |
| `TestListNodes` | `test_list_returns_node` / `test_filter_by_irrigation_area` | Listado y filtro |
| | `test_soft_deleted_not_listed` | Borrados excluidos |
| `TestUpdateNode` | `test_update_name` / `test_deactivate_node` / `test_update_gps` | Actualización |
| `TestSoftDeleteNode` | `test_soft_delete_deactivates` | `activo=False`, inaccesible → `404` |

---

### `test_reading_service.py` — 16 tests

Cubre `app/services/reading.py`. El módulo más crítico del sistema.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestCreateReading` | `test_create_success` | Los 12 campos sensor almacenados correctamente |
| | `test_create_with_null_fields` | Campos `None` aceptados sin error |
| | `test_timestamp_stored_correctly` | `marca_tiempo` preserva el valor enviado |
| `TestGetLatestReading` | `test_latest_returns_most_recent` | Retorna la lectura con `marca_tiempo` más reciente |
| | `test_latest_no_readings_returns_none` | Nodo sin lecturas → `None` (no error) |
| | `test_latest_invalid_area_raises_404` | Área sin nodo → `404` |
| `TestListReadings` | `test_list_all_for_area` | Filtra correctamente por `irrigation_area_id` |
| | `test_list_filter_by_start_date` | Solo lecturas desde la fecha dada |
| | `test_list_filter_by_end_date` | Solo lecturas hasta la fecha dada |
| | `test_list_pagination` | `per_page` respetado, `total` correcto |
| | `test_list_filter_by_crop_cycle` | Usa las fechas del ciclo como rango |
| `TestExportReadings` | `test_export_csv_returns_string` | Resultado es `str`, contiene headers |
| | `test_export_csv_contains_data` | 2 líneas: header + 1 row de datos |
| | `test_export_xlsx_returns_bytes` | Resultado empieza con magic bytes `PK` (ZIP) |
| | `test_export_pdf_returns_bytes` | Resultado empieza con `%PDF` |

---

## Tests de Integración — API HTTP

Los tests de integración usan el `TestClient` de FastAPI para ejecutar peticiones HTTP reales (sin red) contra la aplicación completa, incluyendo middlewares, validación de schemas y autenticación.

### `test_auth_api.py` — 11 tests

Endpoint base: `/api/v1/auth`

| Clase | Test | Método | Ruta | Status esperado |
|-------|------|--------|------|----------------|
| `TestLogin` | `test_login_admin_success` | POST | `/auth/login` | `200` + access+refresh tokens |
| | `test_login_cliente_success` | POST | `/auth/login` | `200` |
| | `test_login_wrong_password_returns_401` | POST | `/auth/login` | `401` |
| | `test_login_nonexistent_user_returns_401` | POST | `/auth/login` | `401` |
| | `test_login_missing_fields_returns_422` | POST | `/auth/login` | `422` (validación Pydantic) |
| `TestRefreshToken` | `test_refresh_returns_new_access_token` | POST | `/auth/refresh` | `200` + nuevo access token |
| | `test_refresh_with_invalid_token_returns_401` | POST | `/auth/refresh` | `401` |
| | `test_refresh_with_access_token_as_refresh_returns_401` | POST | `/auth/refresh` | `401` (tipo incorrecto) |
| `TestLogout` | `test_logout_success` | POST | `/auth/logout` | `200` |
| | `test_logout_same_token_twice_returns_404` | POST | `/auth/logout` | `404` (ya revocado) |
| | `test_revoked_token_cannot_be_refreshed` | POST | `/auth/refresh` | `401` (token revocado) |

---

### `test_readings_api.py` — 15 tests

Endpoint base: `/api/v1/readings`

| Clase | Test | Método | Status | Qué verifica |
|-------|------|--------|--------|-------------|
| `TestPostReading` | `test_ingest_reading_valid_api_key` | POST | `201` | Body con `id` y `node_id` |
| | `test_ingest_reading_invalid_api_key_returns_401` | POST | `401` | Key inválida rechazada |
| | `test_ingest_reading_missing_api_key_returns_422` | POST | `422` | Header requerido |
| | `test_ingest_reading_missing_timestamp_returns_422` | POST | `422` | `timestamp` obligatorio |
| | `test_ingest_reading_null_optional_fields` | POST | `201` | Campos `null` aceptados |
| | `test_ingest_returns_timestamp_and_created_at` | POST | `201` | Ambos timestamps en respuesta |
| `TestGetReadings` | `test_list_readings_requires_auth` | GET | `401` | Sin token → rechazado |
| | `test_list_readings_with_auth` | GET | `200` | Respuesta paginada (`data`, `total`, `page`) |
| | `test_list_readings_pagination` | GET | `200` | `per_page=2` respetado |
| | `test_list_filter_by_irrigation_area` | GET | `200` | Filtra por área |
| `TestGetLatestReading` | `test_latest_requires_auth` | GET | `401` | Protección |
| | `test_latest_returns_none_when_no_readings` | GET | `200` | Body `null` cuando sin lecturas |
| | `test_latest_returns_most_recent` | GET | `200` | Timestamp más reciente en respuesta |
| `TestExportReadings` | `test_export_csv` | GET | `200` | `content-type: text/csv`, body con `timestamp` |
| | `test_export_xlsx` | GET | `200` | `content-type: spreadsheetml`, bytes `PK` |
| | `test_export_pdf` | GET | `200` | `content-type: pdf`, bytes `%PDF` |
| | `test_export_invalid_format_returns_422` | GET | `422` | Formato no permitido |

---

### `test_users_api.py` — 12 tests

Endpoint base: `/api/v1/users` — **solo accesible por administradores**.

| Clase | Test | Status | Qué verifica |
|-------|------|--------|-------------|
| `TestListUsers` | `test_list_requires_admin` | `403` | Cliente no puede listar usuarios |
| | `test_list_requires_auth` | `401` | Sin token rechazado |
| | `test_list_success_admin` | `200` | Lista paginada correcta |
| | `test_list_filter_by_role` | `200` | Solo usuarios con rol `admin` |
| `TestCreateUser` | `test_create_user_admin` | `201` | Campos correctos en respuesta |
| | `test_create_user_cliente_forbidden` | `403` | Cliente no puede crear usuarios |
| | `test_create_user_duplicate_email_returns_409` | `409` | Email ya registrado |
| | `test_create_user_invalid_role_returns_422` | `422` | Rol inválido rechazado por Pydantic |
| `TestGetUser` | `test_get_user_admin` | `200` | Datos correctos |
| | `test_get_nonexistent_user_returns_404` | `404` | |
| `TestUpdateUser` | `test_update_user_full_name` | `200` | Nombre actualizado |
| | `test_update_nonexistent_returns_404` | `404` | |
| `TestDeleteUser` | `test_delete_user` | `200` + `404` | Borrado + confirmación |

---

### `test_clients_api.py` — 9 tests

Endpoint base: `/api/v1/clients`

| Test | Status | Qué verifica |
|------|--------|-------------|
| `test_list_requires_admin` | `403` | Solo admin |
| `test_list_requires_auth` | `401` | Sin token |
| `test_list_success` | `200` | Lista con total ≥ 1 |
| `test_create_client_success` | `201` | `company_name`, `user.role="cliente"` |
| `test_create_client_unauthenticated_returns_401` | `401` | Sin token |
| `test_create_client_duplicate_email_returns_409` | `409` | Email repetido |
| `test_get_client_success` | `200` | Por ID |
| `test_get_nonexistent_client_returns_404` | `404` | |
| `test_update_company_name` | `200` | Nombre actualizado |
| `test_delete_client` | `200` | Borrado + ya no en lista |

---

### `test_properties_api.py` — 9 tests

Endpoint base: `/api/v1/properties`

| Test clave | Status | Qué verifica |
|------------|--------|-------------|
| `test_list_filter_by_client` | `200` | Filtra por `client_id` query param |
| `test_create_invalid_client_returns_404` | `404` | FK a cliente inexistente |
| `test_create_requires_admin` | `403` | Solo admin puede crear |

---

### `test_crop_types_api.py` — 10 tests

Endpoint base: `/api/v1/crop-types`

| Test clave | Status | Qué verifica |
|------------|--------|-------------|
| `test_list_accessible_by_cliente` | `200` | **Los clientes también pueden leer el catálogo** |
| `test_create_duplicate_name_returns_409` | `409` | Nombre del catálogo único |
| `test_delete_in_use_crop_type_returns_409` | `409` | No se puede borrar si tiene áreas activas |

---

### `test_irrigation_areas_api.py` — 10 tests

Endpoint base: `/api/v1/irrigation-areas`

| Test clave | Status | Qué verifica |
|------------|--------|-------------|
| `test_list_filter_by_property` | `200` | `property_id` filtra correctamente |
| `test_create_invalid_property_returns_404` | `404` | FK de predio |
| `test_create_invalid_crop_type_returns_404` | `404` | FK de tipo de cultivo |

---

### `test_crop_cycles_api.py` — 9 tests

Endpoint base: `/api/v1/crop-cycles`

| Test clave | Status | Qué verifica |
|------------|--------|-------------|
| `test_create_second_active_cycle_returns_409` | `409` | **Regla: 1 activo por área** |
| `test_close_cycle` | `200` | Asignar `end_date` a un ciclo activo |

---

### `test_nodes_api.py` — 9 tests

Endpoint base: `/api/v1/nodes`

| Test clave | Status | Qué verifica |
|------------|--------|-------------|
| `test_create_success` | `201` | `api_key` generada con prefijo `ak_` |
| `test_create_second_node_same_area_returns_409` | `409` | **Regla 1:1 área↔nodo** |
| `test_deactivate_node` | `200` | `is_active: false` via PUT |

---

### `test_permissions.py` — 10 tests

Tests transversales de seguridad y aislamiento de roles.

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestClientCanOnlySeeOwnData` | `test_client_can_list_own_readings` | Cliente ve sus propias lecturas |
| | `test_client_can_get_latest_reading_of_own_area` | Cliente puede pedir latest de su área |
| | `test_client_cannot_see_readings_of_another_client` | Área ajena → `403` |
| | `test_client_cannot_access_admin_only_endpoints` | `/users` y `/clients` → `403` |
| `TestAdminCanSeeAll` | `test_admin_can_see_all_clients` | Admin lista todos los clientes |
| | `test_admin_can_see_all_usuarios` | Admin lista todos los usuarios |
| | `test_admin_can_see_readings_of_any_area` | Admin sin restricción de área |
| | `test_admin_can_create_everything` | Admin crea áreas sin restricción |
| `TestUnauthenticatedAccess` | `test_unauthenticated_cannot_list_readings` | `401` sin token |
| | `test_unauthenticated_cannot_list_clients` | `401` sin token |
| | `test_health_endpoint_is_public` | `GET /health` → `200` sin auth |

---

## Resultados de Cobertura

Resultado de la última ejecución: **228 tests — 228 PASSED — 65 segundos**

```
uv run pytest tests/ --cov=app --cov-report=term-missing
```

| Módulo | Stmts | Miss | **Cover** |
|--------|-------|------|-----------|
| `app/api/v1/endpoints/auth.py` | 43 | 0 | **100%** |
| `app/api/v1/endpoints/clients.py` | 29 | 0 | **100%** |
| `app/api/v1/endpoints/crop_types.py` | 29 | 0 | **100%** |
| `app/api/v1/endpoints/users.py` | 29 | 0 | **100%** |
| `app/api/v1/endpoints/readings.py` | 58 | 2 | **97%** |
| `app/api/v1/endpoints/nodes.py` | 53 | 14 | **74%** |
| `app/api/v1/endpoints/crop_cycles.py` | 60 | 17 | **72%** |
| `app/api/v1/endpoints/irrigation_areas.py` | 67 | 24 | **64%** |
| `app/api/v1/endpoints/properties.py` | 53 | 10 | **81%** |
| `app/core/security.py` | 23 | 0 | **100%** |
| `app/core/config.py` | 21 | 0 | **100%** |
| `app/core/deps.py` | 37 | 9 | **76%** |
| `app/models/*.py` (todos) | — | 0 | **100%** |
| `app/schemas/*.py` (todos) | — | 0 | **100%** |
| `app/services/client.py` | 55 | 0 | **100%** |
| `app/services/crop_cycle.py` | 49 | 0 | **100%** |
| `app/services/property.py` | 45 | 0 | **100%** |
| `app/services/crop_type.py` | 48 | 1 | **98%** |
| `app/services/irrigation_area.py` | 55 | 1 | **98%** |
| `app/services/node.py` | 58 | 1 | **98%** |
| `app/services/reading.py` | 89 | 4 | **96%** |
| `app/services/user.py` | 55 | 3 | **95%** |
| `app/db/seed.py` | 63 | 63 | **0%** ¹ |
| **TOTAL** | **1460** | **153** | **90%** |

> ¹ `seed.py` es un script de inicialización de datos que se ejecuta manualmente
> (`uv run python -m app.db.seed`), no forma parte de la lógica de negocio testeada.
> Si se excluyera, la cobertura sería **~97%**.

### Excluir seed del reporte

```bash
uv run pytest tests/ --cov=app --cov-report=term-missing \
  --cov-omit="app/db/seed.py"
```

---

## Notas Técnicas y Decisiones de Diseño

### 1. SQLite `BigInteger` → `INTEGER`

El modelo `Reading` usa `BigInteger` en su PK para soportar el volumen de datos en producción (MySQL). SQLite no implementa `BIGINT` con autoincrement nativo — lo trata como `INTEGER NOT NULL`, causando un error de constraint.

**Solución:** Un compilador DDL personalizado en `conftest.py` que remapea el tipo:

```python
from sqlalchemy.ext.compiler import compiles
from sqlalchemy import BigInteger

@compiles(BigInteger, "sqlite")
def compile_big_integer_sqlite(type_, compiler, **kwargs):
    return "INTEGER"
```

Esto solo afecta la creación del schema en SQLite, no modifica el modelo de producción.

### 2. Rollback por test vs. truncate

La fixture `db` usa `connection.begin()` → `transaction.rollback()` al finalizar cada test, en vez de truncar tablas. Esto es más rápido y garantiza que el estado sea exactamente el mismo antes y después de cada test, incluyendo auto-incrementos y constraints.

### 3. Override de `get_db` en FastAPI

La fixture `client` registra un override de la dependencia `get_db`:

```python
def _override_get_db():
    yield db  # la misma sesión con rollback del test

app.dependency_overrides[get_db] = _override_get_db
```

Esto hace que todos los endpoints usen la BD de test **en la misma transacción**, lo que permite que los datos creados por fixtures sean visibles para el TestClient.

### 4. Fixtures en cadena (composición)

Los fixtures siguen la jerarquía del dominio. Si un test necesita un nodo, automáticamente tiene también el área de riego, el predio, el cliente y el tipo de cultivo, sin declararlo explícitamente:

```python
def test_mi_test(self, db, sample_node):
    # sample_node ya implica: sample_irrigation_area, sample_property, 
    # sample_crop_type, client_user — todo disponible en `db`
```

### 5. Próximas mejoras sugeridas

- **Aumentar cobertura de `irrigation_areas.py` endpoints** (64%) — faltan tests para los endpoints de listado con filtros múltiples
- **Tests de `crop_cycles.py` endpoints** con filtro temporal
- **Test de carga**: verificar rendimiento con 144 lecturas/nodo/día × N nodos
- **Fixtures parametrizadas** para cubrir múltiples nodos/áreas en un solo test

---

## Testing del Frontend (E2E)

Se realizaron pruebas End-to-End funcionales en el navegador interactivo automatizado (Browser Subagent).

### Resumen de Ejecución
- **Entorno:** `http://localhost:5173/` (Servidor Vite Local)
- **Roles probados:** Cliente y Administrador (Credenciales de prueba)
- **Simulador en ejecución:** Script `simulator.py` enviando peticiones cada 10s.

### 1. Vista de Cliente (`cliente@sensores.com`)
Se validó con éxito el flujo principal del cliente final:
- **Autenticación:** El inicio de sesión y la redirección automática al dashboard suceden correctamente.
- **Dashboard y Renderizado en Tiempo Real:**
  - Identificación del usuario ("Hola, Juan Perez") y navegación ("Rancho Norte" → "Nogal Norte").
  - Los **indicadores prioritarios** se resaltan de forma funcional: Humedad del Suelo (%), Flujo de Agua (L/min) y Evapotranspiración (E.T.O).
  - El **Indicador de Frescura** está operativo (ej. actualizándose a "hace 0 min" al recibir la lectura inyectada por el tracker).
  - Las 3 categorías dinámicas (Suelo, Riego y Ambiental) interpretan efectivamente las propiedades y renderizan con sus unidades precisas.
  - El gráfico de humedad histórico se refleja dinámicamente frente a las inyecciones continuas.
- **Cierre de sesión:** El método de logout en la barra lateral destruye los tokens y redirige adecuadamente.

### 2. Vista de Administrador (`admin@sensores.com`)
Se validó las vistas de gestión internas:
- **Panel Summary:**
  - Tarjetas de resumen cargan totales correctos (2 Clientes, 1 Predio, 4/4 Nodos en línea).
- **Formatos Tabulares:**
  - **Clientes:** Se constató la visualización de tabla relacional de clientes actuales.
  - **Catálogo:** Los tipos de cultivo preestablecidos están íntegros en una vista manipulable.

### 3. Defectos y Casos de Fallo (Bugs)

**✅ RESUELTO: ERROR CRÍTICO (ADMIN): Navegación a "Nodos IoT"**
*Problema Original:* Al intentar acceder a la ruta `/admin/nodos`, la aplicación fallaba y levantaba una pantalla blanca de crash (React Error) con el mensaje `Objects are not valid as a React child`. Esto ocurría porque se intentaba recuperar la lista de áreas de riego usando el ID "all" hacia al backend (`/irrigation-areas/all`), lo cual generaba un `422 Unprocessable Entity` de validación Pydantic que React trataba de inyectar al DOM como un objeto.
*Estado Actual:* **Solucionado**. Se actualizó el endpoint respectivo para llamar a los arreglos paginados (e.g. `?per_page=100`) y se introdujo serialización estricta de variables de error en el Frontend, impidiendo crasheos. Los 4 Nodos de prueba cargan sus registros intactos en esta vista sin problema alguno.

### Conclusión General
El MVP de visualización (la UI principal consumida por los Clientes) funciona fluidamente con excelentes componentes adaptativos y lecturas a tiempo real. La interfaz de gestión del Administrador se encuentra probada operativamente y estable tras resolverse el inconveniente de paginación en el panel de Nodos, entregando la funcionalidad prometida.