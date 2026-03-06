# Documentación de la API REST — Sistema IoT de Riego Agrícola

> **Audiencia:** Desarrolladores del equipo (frontend y backend).
> **Propósito:** Entender cómo funciona la API del sistema, qué endpoints existen, cómo autenticarse, qué enviar y qué esperar como respuesta. Este documento acompaña al spec técnico `openapi.yaml` (importable en Swagger UI / Postman).
> **Referencia:** La arquitectura general está en `AGENTS.md`. El modelo de datos en `agente_base_de_datos.md` y `documentacion_base_de_datos.md`.

---

## Tabla de Contenidos

1. [Cómo Encaja la API en la Arquitectura](#1-cómo-encaja-la-api-en-la-arquitectura)
2. [OpenAPI y FastAPI — Documentación Automática](#2-openapi-y-fastapi--documentación-automática)
3. [Autenticación](#3-autenticación)
4. [Convenciones Generales](#4-convenciones-generales)
5. [Endpoints por Recurso](#5-endpoints-por-recurso)
   - 5.1 [Auth](#51-auth)
   - 5.2 [Users (Usuarios)](#52-users-usuarios)
   - 5.3 [Clients (Clientes)](#53-clients-clientes)
   - 5.4 [Properties (Predios)](#54-properties-predios)
   - 5.5 [Crop Types (Tipos de Cultivo)](#55-crop-types-tipos-de-cultivo)
   - 5.6 [Irrigation Areas (Áreas de Riego)](#56-irrigation-areas-áreas-de-riego)
   - 5.7 [Crop Cycles (Ciclos de Cultivo)](#57-crop-cycles-ciclos-de-cultivo)
   - 5.8 [Nodes (Nodos IoT)](#58-nodes-nodos-iot)
   - 5.9 [Readings (Lecturas)](#59-readings-lecturas)
6. [Flujo de Ejemplo Completo](#6-flujo-de-ejemplo-completo)
7. [Referencia Rápida de Endpoints](#7-referencia-rápida-de-endpoints)

---

## 1. Cómo Encaja la API en la Arquitectura

El sistema tiene 4 componentes que se comunican a través de la API REST del backend:

```
┌──────────────────┐         ┌──────────────────────────────────┐         ┌─────────────┐
│  MÓDULO DE       │  POST   │       BACKEND (FastAPI)           │  SELECT │             │
│  CONTROL         │────────▶│       Puerto 5050                 │◀──────▶│  MySQL 8    │
│  (Simulador)     │ X-API-Key│                                  │ INSERT  │  Puerto 3306│
│  PC local        │         │  ┌─────────────────────────────┐  │         │             │
└──────────────────┘         │  │  API REST /api/v1/...       │  │         └─────────────┘
                             │  │  • Ingesta de lecturas      │  │
┌──────────────────┐  GET    │  │  • CRUD de entidades        │  │
│  FRONTEND        │────────▶│  │  • Auth (JWT)               │  │
│  (React SPA)     │ Bearer  │  │  • Exportación              │  │
│  Nginx           │◀────────│  │  • Swagger UI (/docs)       │  │
└──────────────────┘  JSON   │  └─────────────────────────────┘  │
                             └──────────────────────────────────┘
                                        ▲
                                        │ Nginx reverse proxy
                                        │ puertos 80/443
                                        ▼
                                    INTERNET
```

**¿Quién habla con la API?**

| Actor | Qué hace | Cómo se autentica | Endpoints que usa |
|-------|---------|-------------------|-------------------|
| **Simulador** (Módulo de Control) | Envía lecturas de sensores cada 10 min | Header `X-API-Key` | Solo `POST /api/v1/readings` |
| **Frontend — Admin** | Gestiona toda la plataforma (clientes, predios, áreas, nodos, cultivos, ciclos) + ve todos los dashboards | Header `Authorization: Bearer <JWT>` | Todos los endpoints |
| **Frontend — Cliente** | Ve dashboard, histórico y exporta datos de SUS predios/áreas | Header `Authorization: Bearer <JWT>` | GET de properties, irrigation-areas, crop-cycles, nodes, readings + export |

**El backend (puerto 5050)** es el único punto de contacto con la base de datos. Ni el frontend ni el simulador hablan directamente con MySQL — todo pasa por la API.

**Nginx** actúa como reverse proxy público: recibe tráfico en puertos 80/443 y lo redirige al backend (5050) o al frontend estático según la URL.

---

## 2. OpenAPI y FastAPI — Documentación Automática

### ¿Qué es OpenAPI?

OpenAPI (antes Swagger) es un estándar para describir APIs REST. Es un archivo YAML/JSON que lista todos los endpoints, parámetros, schemas de request/response, y mecanismos de autenticación. Herramientas como Swagger UI o Postman lo leen y generan documentación interactiva.

### FastAPI lo genera automáticamente

FastAPI genera el spec OpenAPI a partir del código Python. Cuando defines un endpoint con typing y Pydantic models, FastAPI automáticamente:
- Documenta el path, método, parámetros y body
- Genera los schemas de request/response
- Aplica las validaciones
- Publica una UI interactiva

### URLs de documentación (cuando el backend esté corriendo)

| URL | Qué es | Para qué sirve |
|-----|--------|----------------|
| `http://localhost:5050/docs` | **Swagger UI** | Documentación interactiva. Puedes probar los endpoints directamente desde el navegador. |
| `http://localhost:5050/redoc` | **ReDoc** | Documentación en formato lectura (más limpia para leer, sin botones de prueba). |
| `http://localhost:5050/openapi.json` | **Spec JSON** | El spec OpenAPI crudo en JSON. Para importar en Postman u otras herramientas. |

> **Nota:** El archivo `openapi.yaml` incluido en este repo es el spec de **diseño** — define cómo DEBE quedar la API. Cuando el backend esté implementado, FastAPI generará su propia versión automáticamente desde el código. Ambos deben coincidir.

---

## 3. Autenticación

El sistema tiene **dos mecanismos de autenticación** completamente separados, uno para usuarios web y otro para los sensores IoT.

### 3.1. JWT — Para usuarios web (Admin y Cliente)

JWT (JSON Web Token) es un token encriptado que el backend genera al hacer login. El frontend lo guarda en memoria y lo envía en cada petición.

**Flujo completo:**

```
1. LOGIN
   POST /api/v1/auth/login
   Body: { "email": "admin@sensores.com", "password": "mi_clave" }
   ↓
   Response 200: {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
     "token_type": "bearer"
   }

2. USO — En cada petición, el frontend envía el access_token:
   GET /api/v1/properties
   Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

3. RENOVACIÓN — Cuando el access_token expira (~15-30 min):
   POST /api/v1/auth/refresh
   Body: { "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..." }
   ↓
   Response 200: {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...(nuevo)...",
     "refresh_token": "bmV3IHJlZnJlc2ggdG9rZW4...(nuevo, rotado)...",
     "token_type": "bearer"
   }

4. LOGOUT — Revoca el refresh_token:
   POST /api/v1/auth/logout
   Body: { "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..." }
   Header: Authorization: Bearer eyJhbGci...
   ↓
   Response 200: { "message": "Successfully logged out" }
```

**¿Qué contiene el access_token?** (decodificado)
```json
{
  "sub": 2,              // usuario_id
  "role": "cliente",     // rol del usuario
  "exp": 1740000000      // timestamp de expiración
}
```

**Permisos por rol:**

| Endpoint | Admin | Cliente |
|----------|-------|---------|
| Auth (login/refresh/logout) | ✅ | ✅ |
| Users CRUD | ✅ | ❌ |
| Clients CRUD | ✅ | ❌ |
| Properties — GET | ✅ (todos) | ✅ (solo suyos) |
| Properties — POST/PUT/DELETE | ✅ | ❌ |
| Crop Types CRUD | ✅ | ❌ |
| Irrigation Areas — GET | ✅ (todos) | ✅ (solo suyos) |
| Irrigation Areas — POST/PUT/DELETE | ✅ | ❌ |
| Crop Cycles — GET | ✅ (todos) | ✅ (solo suyos) |
| Crop Cycles — POST/PUT/DELETE | ✅ | ❌ |
| Nodes — GET | ✅ (todos) | ✅ (solo suyos) |
| Nodes — POST/PUT/DELETE | ✅ | ❌ |
| Readings — GET (histórico, latest) | ✅ (todos) | ✅ (solo suyos) |
| Readings — GET export | ✅ (todos) | ✅ (solo suyos) |

> **"Solo suyos"** significa: el backend verifica que el recurso solicitado pertenece a la cadena Cliente → Predio → Área del usuario autenticado. Si un cliente intenta ver datos de otro cliente, recibe **403 Forbidden**.

### 3.2. API Key — Para nodos IoT (Simulador)

Cada nodo tiene una **API Key fija** (string único, nunca expira) que se genera al registrar el nodo. El simulador la envía en un header custom en cada POST de lectura.

```
POST /api/v1/readings
Header: X-API-Key: ak_n01_a1b2c3d4e5f6
Body: { "timestamp": "...", "soil": {...}, "irrigation": {...}, "environmental": {...} }
```

**Validación del backend:**
1. ¿Existe el header `X-API-Key`? → Si no: **401 Unauthorized**
2. ¿Existe un nodo con esa api_key en la BD? → Si no: **401 Unauthorized**
3. ¿El nodo está activo y no eliminado? → Si no: **403 Forbidden**
4. Todo OK → Guarda la lectura asociada al nodo

> La API Key **solo sirve para `POST /api/v1/readings`**. No se puede usar para consultar datos ni para ningún otro endpoint.

---

## 4. Convenciones Generales

### 4.1. Estructura de URLs

Todas las URLs siguen este patrón:

```
/api/v1/{recurso}          → Listar (GET) o Crear (POST)
/api/v1/{recurso}/{id}     → Detalle (GET), Actualizar (PUT) o Eliminar (DELETE)
```

**Reglas:**
- Siempre en **inglés**
- Siempre en **plural**: `/clients`, `/properties`, `/nodes` (no `/client`, `/node`)
- **Versionadas**: prefijo `/api/v1/`. Si la API cambia de forma incompatible, se crea `/api/v2/`
- Palabras compuestas con **guión**: `/irrigation-areas`, `/crop-types`, `/crop-cycles`

### 4.2. Métodos HTTP

| Método | Acción | Ejemplo | Código de éxito |
|--------|--------|---------|-----------------|
| `GET` | Listar con paginación | `GET /api/v1/clients?page=1&per_page=50` | 200 OK |
| `GET` | Obtener detalle | `GET /api/v1/clients/5` | 200 OK |
| `POST` | Crear recurso | `POST /api/v1/clients` + Body JSON | 201 Created |
| `PUT` | Actualizar recurso | `PUT /api/v1/clients/5` + Body JSON | 200 OK |
| `DELETE` | Eliminar (soft delete) | `DELETE /api/v1/clients/5` | 200 OK |

### 4.3. Paginación

**Obligatoria en todos los endpoints de listado (GET sin ID).**

**Query params:**
- `page` — Número de página (default: `1`)
- `per_page` — Items por página (default: `50`)

**Formato de respuesta paginada:**
```json
{
  "page": 1,
  "per_page": 50,
  "total": 128,
  "data": [
    { "id": 1, "..." : "..." },
    { "id": 2, "..." : "..." }
  ]
}
```

- `total` = número total de registros que coinciden con los filtros (no solo los de esta página)
- `data` = array con los registros de la página actual
- Si `page * per_page > total`, `data` viene con menos elementos o vacío

### 4.4. Filtros de Fecha

Para endpoints que lo soporten (readings, crop-cycles):

```
GET /api/v1/readings?start_date=2026-01-01&end_date=2026-01-31
```

- **`start_date`** — Fecha inicio del rango (formato `YYYY-MM-DD`). Opcional.
- **`end_date`** — Fecha fin del rango (formato `YYYY-MM-DD`). Opcional.
- Si solo se envía `start_date`, retorna todo desde esa fecha en adelante.
- Si solo se envía `end_date`, retorna todo hasta esa fecha.
- Si no se envía ninguno, retorna todo (paginado).

> **Los presets de fecha (semana, mes, año) se resuelven en el frontend.** El frontend calcula las fechas y las envía como `start_date` / `end_date`. La API no tiene concepto de "última semana" — solo entiende rangos de fechas.

### 4.5. Códigos de Respuesta HTTP

| Código | Cuándo | Ejemplo |
|--------|--------|---------|
| **200** OK | Operación exitosa (GET, PUT, DELETE) | Listado, detalle, actualización, eliminación |
| **201** Created | Recurso creado exitosamente (POST) | Nuevo cliente, nuevo nodo, nueva lectura |
| **400** Bad Request | Petición mal formada | JSON inválido, campo requerido faltante |
| **401** Unauthorized | Sin autenticación o token/key inválido | Token JWT expirado, API Key inexistente |
| **403** Forbidden | Autenticado pero sin permisos | Cliente intentando ver datos de otro cliente |
| **404** Not Found | Recurso no existe | `GET /api/v1/clients/999` cuando no existe |
| **409** Conflict | Conflicto de negocio | Correo duplicado, ciclo activo ya existe para esa área |
| **422** Unprocessable Entity | Validación de datos fallida | Tipo de dato incorrecto (Pydantic) |
| **500** Internal Server Error | Error inesperado del servidor | Bug en el código, BD caída |

### 4.6. Formato de Errores

Todos los errores siguen la convención de FastAPI:

```json
{
  "detail": "Client with id 999 not found"
}
```

Para errores de validación (422), Pydantic retorna más detalle:

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 4.7. Nomenclatura: Español en BD ↔ Inglés en API

Las tablas y columnas de la BD están en **español** (`clientes`, `nombre_empresa`), pero la API y sus schemas están en **inglés** (`clients`, `company_name`). Los schemas Pydantic del backend hacen la traducción.

Ejemplo de mapeo:

| BD (español) | API (inglés) |
|-------------|-------------|
| `clientes.nombre_empresa` | `company_name` |
| `predios.ubicacion` | `location` |
| `areas_riego.tamano_area` | `area_size` |
| `nodos.numero_serie` | `serial_number` |
| `lecturas.marca_tiempo` | `timestamp` |

---

## 5. Endpoints por Recurso

### 5.1. Auth

Endpoints de autenticación. No requieren token previo (excepto logout).

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/login` | Iniciar sesión | Ninguna (público) |
| `POST` | `/api/v1/auth/refresh` | Renovar access token | Ninguna (usa refresh_token en body) |
| `POST` | `/api/v1/auth/logout` | Cerrar sesión (revocar refresh token) | Bearer JWT |

#### `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "admin@sensores.com",
  "password": "mi_contraseña_segura"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "a8f3b2e1d4c6...",
  "token_type": "bearer"
}
```

**Errores:** 401 (credenciales incorrectas), 403 (usuario deshabilitado).

#### `POST /api/v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "a8f3b2e1d4c6..."
}
```

**Response 200:** Misma estructura que login (nuevos tokens). El refresh token anterior se revoca automáticamente (rotación).

**Errores:** 401 (token inválido, expirado o revocado).

#### `POST /api/v1/auth/logout`

**Request:**
```json
{
  "refresh_token": "a8f3b2e1d4c6..."
}
```

**Response 200:**
```json
{
  "message": "Successfully logged out"
}
```

---

### 5.2. Users (Usuarios)

Gestión de cuentas de usuario. **Solo Admin.**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/users` | Listar usuarios (paginado) |
| `POST` | `/api/v1/users` | Crear usuario |
| `GET` | `/api/v1/users/{id}` | Detalle de un usuario |
| `PUT` | `/api/v1/users/{id}` | Actualizar usuario |
| `DELETE` | `/api/v1/users/{id}` | Eliminar usuario (soft delete) |

#### Crear usuario — `POST /api/v1/users`

**Request:**
```json
{
  "email": "jlopez@correo.com",
  "password": "contraseña_segura_123",
  "full_name": "Juan López",
  "role": "cliente",
  "is_active": true
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `email` | string | Sí | Debe ser único. Usado como login. |
| `password` | string | Sí | Se hashea con bcrypt antes de guardar. Nunca se retorna en responses. |
| `full_name` | string | Sí | Nombre completo. |
| `role` | string | Sí | `"admin"` o `"cliente"`. |
| `is_active` | boolean | No | Default: `true`. |

**Response 201:**
```json
{
  "id": 2,
  "email": "jlopez@correo.com",
  "full_name": "Juan López",
  "role": "cliente",
  "is_active": true,
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

> **Nota:** `password` nunca aparece en las respuestas. `created_at` y `updated_at` se generan automáticamente.

#### Actualizar usuario — `PUT /api/v1/users/{id}`

**Request** (solo los campos que cambian):
```json
{
  "full_name": "Juan A. López",
  "is_active": false
}
```

**Errores especiales:** 409 si se intenta cambiar el email a uno que ya existe.

#### Listar usuarios — `GET /api/v1/users`

**Query params opcionales:** `?page=1&per_page=50&role=cliente`

**Response 200:**
```json
{
  "page": 1,
  "per_page": 50,
  "total": 3,
  "data": [
    {
      "id": 1,
      "email": "admin@sensores.com",
      "full_name": "Administrador",
      "role": "admin",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### 5.3. Clients (Clientes)

Gestión de clientes (datos de negocio del agricultor). **Solo Admin.**

Recordatorio: crear un cliente implica **dos registros** — uno en `usuarios` (auth) y otro en `clientes` (negocio). El endpoint `POST /api/v1/clients` crea ambos en una sola operación.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/clients` | Listar clientes (paginado) |
| `POST` | `/api/v1/clients` | Crear cliente (+ usuario asociado) |
| `GET` | `/api/v1/clients/{id}` | Detalle de un cliente |
| `PUT` | `/api/v1/clients/{id}` | Actualizar datos del cliente |
| `DELETE` | `/api/v1/clients/{id}` | Eliminar cliente (soft delete) |

#### Crear cliente — `POST /api/v1/clients`

**Request:**
```json
{
  "email": "jlopez@correo.com",
  "password": "contraseña_segura_123",
  "full_name": "Juan López",
  "company_name": "Agrícola López S.A.",
  "phone": "614-555-1234",
  "address": "Km 5 Carretera Delicias"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `email` | string | Sí | Para crear el `usuario` asociado |
| `password` | string | Sí | Para crear el `usuario` asociado |
| `full_name` | string | Sí | Para crear el `usuario` asociado |
| `company_name` | string | Sí | Nombre de la empresa/rancho |
| `phone` | string | No | Teléfono de contacto |
| `address` | string | No | Dirección textual |

**Response 201:**
```json
{
  "id": 1,
  "user_id": 2,
  "company_name": "Agrícola López S.A.",
  "phone": "614-555-1234",
  "address": "Km 5 Carretera Delicias",
  "user": {
    "id": 2,
    "email": "jlopez@correo.com",
    "full_name": "Juan López",
    "role": "cliente",
    "is_active": true
  },
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

> **Internamente:** Crea 1 registro en `usuarios` (rol='cliente') + 1 registro en `clientes` en una transacción atómica.

#### Detalle — `GET /api/v1/clients/{id}`

**Response 200:** Misma estructura que la respuesta de crear, con el objeto `user` anidado.

---

### 5.4. Properties (Predios)

Gestión de terrenos/ranchos. **Admin crea/edita/elimina. Cliente solo ve los suyos.**

| Método | Endpoint | Descripción | Quién |
|--------|----------|-------------|-------|
| `GET` | `/api/v1/properties` | Listar predios | Admin: todos. Cliente: solo suyos. |
| `POST` | `/api/v1/properties` | Crear predio | Admin |
| `GET` | `/api/v1/properties/{id}` | Detalle de un predio | Admin: cualquiera. Cliente: solo suyos. |
| `PUT` | `/api/v1/properties/{id}` | Actualizar predio | Admin |
| `DELETE` | `/api/v1/properties/{id}` | Eliminar predio (soft delete) | Admin |

#### Crear predio — `POST /api/v1/properties`

**Request:**
```json
{
  "client_id": 1,
  "name": "Rancho Norte",
  "location": "Km 5 Carretera Delicias-Meoqui"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `client_id` | integer | Sí | ID del cliente dueño |
| `name` | string | Sí | Nombre del predio |
| `location` | string | No | Referencia geográfica textual (no GPS) |

**Response 201:**
```json
{
  "id": 1,
  "client_id": 1,
  "name": "Rancho Norte",
  "location": "Km 5 Carretera Delicias-Meoqui",
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

#### Listar predios — `GET /api/v1/properties`

**Query params:** `?page=1&per_page=50&client_id=1`

- `client_id` — Filtro opcional. Admin puede filtrar por cliente. **Para un usuario Cliente, el backend filtra automáticamente por su propio client_id** (no necesita enviar el parámetro).

---

### 5.5. Crop Types (Tipos de Cultivo)

Catálogo administrable de cultivos. **Solo Admin puede crear/editar/eliminar.** Ambos roles pueden listar.

| Método | Endpoint | Descripción | Quién |
|--------|----------|-------------|-------|
| `GET` | `/api/v1/crop-types` | Listar tipos de cultivo | Admin y Cliente |
| `POST` | `/api/v1/crop-types` | Crear tipo de cultivo | Admin |
| `GET` | `/api/v1/crop-types/{id}` | Detalle | Admin y Cliente |
| `PUT` | `/api/v1/crop-types/{id}` | Actualizar | Admin |
| `DELETE` | `/api/v1/crop-types/{id}` | Eliminar (soft delete) | Admin |

#### Crear tipo de cultivo — `POST /api/v1/crop-types`

**Request:**
```json
{
  "name": "Sorgo",
  "description": "Sorgo para forraje"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `name` | string | Sí | Debe ser único |
| `description` | string | No | Nota descriptiva |

**Response 201:**
```json
{
  "id": 7,
  "name": "Sorgo",
  "description": "Sorgo para forraje",
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

**Errores especiales:**
- 409 si el nombre ya existe.
- DELETE retorna 409 si hay áreas de riego activas usando ese cultivo (ON DELETE RESTRICT).

**Seed data (ya cargados al instalar):** Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón.

---

### 5.6. Irrigation Areas (Áreas de Riego)

Parcelas dentro de un predio. **La entidad central del sistema.** Admin crea/edita/elimina. Cliente ve las suyas.

| Método | Endpoint | Descripción | Quién |
|--------|----------|-------------|-------|
| `GET` | `/api/v1/irrigation-areas` | Listar áreas | Admin: todas. Cliente: solo suyas. |
| `POST` | `/api/v1/irrigation-areas` | Crear área | Admin |
| `GET` | `/api/v1/irrigation-areas/{id}` | Detalle de un área | Admin: cualquiera. Cliente: solo suyas. |
| `PUT` | `/api/v1/irrigation-areas/{id}` | Actualizar área | Admin |
| `DELETE` | `/api/v1/irrigation-areas/{id}` | Eliminar área (soft delete) | Admin |

#### Crear área — `POST /api/v1/irrigation-areas`

**Request:**
```json
{
  "property_id": 1,
  "crop_type_id": 1,
  "name": "Nogal Norte",
  "area_size": 15.50
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `property_id` | integer | Sí | ID del predio que contiene esta área |
| `crop_type_id` | integer | Sí | ID del tipo de cultivo (del catálogo) |
| `name` | string | Sí | Nombre descriptivo |
| `area_size` | number | No | Tamaño en hectáreas |

**Response 201:**
```json
{
  "id": 1,
  "property_id": 1,
  "crop_type_id": 1,
  "name": "Nogal Norte",
  "area_size": 15.50,
  "crop_type": {
    "id": 1,
    "name": "Nogal"
  },
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

#### Listar áreas — `GET /api/v1/irrigation-areas`

**Query params:** `?page=1&per_page=50&property_id=1`

- `property_id` — Filtro opcional (Admin) o automático (Cliente).
- La respuesta incluye el objeto `crop_type` anidado para evitar una segunda petición.

---

### 5.7. Crop Cycles (Ciclos de Cultivo)

Temporadas agrícolas por área. Admin gestiona. Cliente puede ver los de sus áreas.

| Método | Endpoint | Descripción | Quién |
|--------|----------|-------------|-------|
| `GET` | `/api/v1/crop-cycles` | Listar ciclos | Admin: todos. Cliente: solo sus áreas. |
| `POST` | `/api/v1/crop-cycles` | Crear ciclo | Admin |
| `GET` | `/api/v1/crop-cycles/{id}` | Detalle | Admin: cualquiera. Cliente: solo suyos. |
| `PUT` | `/api/v1/crop-cycles/{id}` | Actualizar (ej. cerrar ciclo) | Admin |
| `DELETE` | `/api/v1/crop-cycles/{id}` | Eliminar (soft delete) | Admin |

#### Crear ciclo — `POST /api/v1/crop-cycles`

**Request:**
```json
{
  "irrigation_area_id": 1,
  "start_date": "2026-02-01",
  "end_date": null
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `irrigation_area_id` | integer | Sí | Área a la que pertenece |
| `start_date` | string (date) | Sí | Formato `YYYY-MM-DD` |
| `end_date` | string (date) | No | `null` = ciclo activo (en curso) |

**Response 201:**
```json
{
  "id": 2,
  "irrigation_area_id": 1,
  "start_date": "2026-02-01",
  "end_date": null,
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

**Errores especiales:** 409 si ya existe un ciclo activo (`end_date IS NULL`) para esa área. Primero hay que cerrar el anterior (PUT con `end_date`).

#### Listar ciclos — `GET /api/v1/crop-cycles`

**Query params:** `?page=1&per_page=50&irrigation_area_id=1`

- `irrigation_area_id` — Filtro recomendado para obtener los ciclos de un área específica.

---

### 5.8. Nodes (Nodos IoT)

Sensores instalados en campo. **Admin gestiona.** Cliente ve los de sus áreas.

| Método | Endpoint | Descripción | Quién |
|--------|----------|-------------|-------|
| `GET` | `/api/v1/nodes` | Listar nodos | Admin: todos. Cliente: solo suyos. |
| `POST` | `/api/v1/nodes` | Registrar nodo (genera API Key) | Admin |
| `GET` | `/api/v1/nodes/{id}` | Detalle de un nodo | Admin: cualquiera. Cliente: solo suyos. |
| `PUT` | `/api/v1/nodes/{id}` | Actualizar nodo | Admin |
| `DELETE` | `/api/v1/nodes/{id}` | Eliminar nodo (soft delete) | Admin |

#### Registrar nodo — `POST /api/v1/nodes`

**Request:**
```json
{
  "irrigation_area_id": 1,
  "serial_number": "SN-2026-001",
  "name": "Sensor Nogal Norte",
  "latitude": 28.1867530,
  "longitude": -105.4714920,
  "is_active": true
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `irrigation_area_id` | integer | Sí | Área que monitorea (1:1, debe estar libre) |
| `serial_number` | string | No | Identificador físico del dispositivo |
| `name` | string | No | Nombre descriptivo |
| `latitude` | number | No | GPS latitud (se registra una vez) |
| `longitude` | number | No | GPS longitud (se registra una vez) |
| `is_active` | boolean | No | Default: `true` |

**Response 201:**
```json
{
  "id": 1,
  "irrigation_area_id": 1,
  "api_key": "ak_n01_a1b2c3d4e5f6g7h8i9j0",
  "serial_number": "SN-2026-001",
  "name": "Sensor Nogal Norte",
  "latitude": 28.1867530,
  "longitude": -105.4714920,
  "is_active": true,
  "created_at": "2026-03-05T10:30:00Z",
  "updated_at": "2026-03-05T10:30:00Z"
}
```

> **`api_key` se genera automáticamente** por el backend al crear el nodo. Es el string que el simulador usará en el header `X-API-Key`. Se retorna **solo en la respuesta del POST** (creación). En los GET subsecuentes puede mostrarse o enmascararse según la decisión de implementación.

**Errores especiales:** 409 si `irrigation_area_id` ya tiene un nodo asignado (relación 1:1).

#### Listar nodos — `GET /api/v1/nodes`

**Query params:** `?page=1&per_page=50&irrigation_area_id=1`

---

### 5.9. Readings (Lecturas)

Los datos de los sensores. Tiene 4 operaciones con comportamientos muy diferentes:

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/readings` | **Ingesta de sensor** (simulador envía datos) | API Key (`X-API-Key`) |
| `GET` | `/api/v1/readings` | **Histórico** paginado con filtros | JWT (Admin/Cliente) |
| `GET` | `/api/v1/readings/latest` | **Última lectura** de un área (frescura) | JWT (Admin/Cliente) |
| `GET` | `/api/v1/readings/export` | **Exportar** datos filtrados (CSV/XLSX/PDF) | JWT (Admin/Cliente) |

#### Ingesta de sensor — `POST /api/v1/readings`

**Auth:** Header `X-API-Key: <api_key_del_nodo>`

**Request (el payload del sensor):**
```json
{
  "timestamp": "2026-02-24T14:30:00Z",
  "soil": {
    "conductivity": 2.5,
    "temperature": 22.3,
    "humidity": 45.6,
    "water_potential": -0.8
  },
  "irrigation": {
    "active": true,
    "accumulated_liters": 1250.0,
    "flow_per_minute": 8.3
  },
  "environmental": {
    "temperature": 28.1,
    "relative_humidity": 55.0,
    "wind_speed": 12.5,
    "solar_radiation": 650.0,
    "eto": 5.2
  }
}
```

**Campos del payload:**

| Categoría | Campo | Tipo | Unidad | Notas |
|-----------|-------|------|--------|-------|
| _(raíz)_ | `timestamp` | string (datetime) | ISO 8601 UTC | **Obligatorio**. Cuándo el sensor tomó la medición. |
| **soil** | `conductivity` | number \| null | dS/m | Conductividad eléctrica |
| | `temperature` | number \| null | °C | Temperatura del suelo |
| | `humidity` | number \| null | % | ⭐ **Humedad del suelo** (prioritario) |
| | `water_potential` | number \| null | MPa | Valores negativos |
| **irrigation** | `active` | boolean \| null | — | Riego encendido/apagado |
| | `accumulated_liters` | number \| null | L | Litros acumulados |
| | `flow_per_minute` | number \| null | L/min | ⭐ **Flujo de agua** (prioritario) |
| **environmental** | `temperature` | number \| null | °C | Temperatura ambiente |
| | `relative_humidity` | number \| null | % | Humedad del aire |
| | `wind_speed` | number \| null | km/h | Velocidad del viento |
| | `solar_radiation` | number \| null | W/m² | Radiación solar |
| | `eto` | number \| null | mm/día | ⭐ **Evapotranspiración** (prioritario) |

> Si un campo no está disponible, se envía como `null` o `0`. Las 3 categorías (`soil`, `irrigation`, `environmental`) siempre deben estar presentes en el JSON, aunque sus campos internos sean null.

**Response 201:**
```json
{
  "id": 1001,
  "node_id": 1,
  "timestamp": "2026-02-24T14:30:00Z",
  "created_at": "2026-02-24T14:30:03Z"
}
```

**Internamente:** Se ejecuta una transacción atómica que inserta 1 fila en `lecturas` + 1 fila en `lecturas_suelo` + 1 fila en `lecturas_riego` + 1 fila en `lecturas_ambiental`. Si algo falla, se hace rollback completo.

#### Histórico — `GET /api/v1/readings`

**Auth:** Header `Authorization: Bearer <jwt>`

**Query params:**

| Param | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `irrigation_area_id` | integer | Sí* | Filtra por área. *El cliente debe especificarlo; el admin puede omitirlo. |
| `start_date` | string (date) | No | Inicio del rango |
| `end_date` | string (date) | No | Fin del rango |
| `crop_cycle_id` | integer | No | Filtra usando las fechas del ciclo (alternativa a start_date/end_date) |
| `page` | integer | No | Default: 1 |
| `per_page` | integer | No | Default: 50 |

**Response 200:**
```json
{
  "page": 1,
  "per_page": 50,
  "total": 1440,
  "data": [
    {
      "id": 1001,
      "node_id": 1,
      "timestamp": "2026-02-24T14:00:00Z",
      "soil": {
        "conductivity": 2.5,
        "temperature": 22.3,
        "humidity": 45.6,
        "water_potential": -0.8
      },
      "irrigation": {
        "active": true,
        "accumulated_liters": 1250.0,
        "flow_per_minute": 8.3
      },
      "environmental": {
        "temperature": 28.1,
        "relative_humidity": 55.0,
        "wind_speed": 12.5,
        "solar_radiation": 650.0,
        "eto": 5.2
      }
    }
  ]
}
```

> Cada lectura incluye las 3 categorías de datos (resultado del JOIN a las 3 tablas hijas). La estructura es idéntica al payload de ingesta pero con `id` y `node_id` adicionales.

#### Última lectura (frescura) — `GET /api/v1/readings/latest`

**Auth:** Header `Authorization: Bearer <jwt>`

**Query params:**

| Param | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `irrigation_area_id` | integer | Sí | ¿De qué área quieres la última lectura? |

**Response 200:**
```json
{
  "id": 2880,
  "node_id": 1,
  "timestamp": "2026-03-05T09:20:00Z",
  "soil": {
    "conductivity": 2.4,
    "temperature": 21.8,
    "humidity": 43.2,
    "water_potential": -0.85
  },
  "irrigation": {
    "active": true,
    "accumulated_liters": 2100.0,
    "flow_per_minute": 8.1
  },
  "environmental": {
    "temperature": 26.5,
    "relative_humidity": 58.0,
    "wind_speed": 10.2,
    "solar_radiation": 580.0,
    "eto": 4.8
  }
}
```

> El frontend calcula el "tiempo transcurrido" comparando `timestamp` con la hora actual. Ejemplo: si `timestamp` es de hace 12 minutos, muestra "Último dato: hace 12 min". Si es de hace más de 20 minutos, muestra una alerta visual.

#### Exportar datos — `GET /api/v1/readings/export`

**Auth:** Header `Authorization: Bearer <jwt>`

**Query params:**

| Param | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `format` | string | Sí | `"csv"`, `"xlsx"` o `"pdf"` |
| `irrigation_area_id` | integer | Sí* | Misma lógica que histórico |
| `start_date` | string (date) | No | Inicio del rango |
| `end_date` | string (date) | No | Fin del rango |
| `crop_cycle_id` | integer | No | Alternativa a start/end date |

**Response:** Archivo binario para descarga directa.

| Formato | Content-Type | Extensión |
|---------|-------------|-----------|
| `csv` | `text/csv` | `.csv` |
| `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| `pdf` | `application/pdf` | `.pdf` |

Header de respuesta: `Content-Disposition: attachment; filename="readings_area1_2026-01-01_2026-01-31.csv"`

> La exportación aplica los **mismos filtros** que el histórico. La diferencia es que en vez de retornar JSON paginado, retorna un archivo con **todos** los registros que coincidan con los filtros (sin paginación).

---

## 6. Flujo de Ejemplo Completo

Este ejemplo recorre todo el sistema de punta a punta: desde crear un cliente hasta consultar sus datos en el dashboard.

### Paso 1: Admin hace login

```
POST /api/v1/auth/login
Body: { "email": "admin@sensores.com", "password": "admin123" }
→ 200: { "access_token": "eyJ...", "refresh_token": "abc...", "token_type": "bearer" }
```

### Paso 2: Admin crea un cliente

```
POST /api/v1/clients
Header: Authorization: Bearer eyJ...
Body: {
  "email": "jlopez@correo.com",
  "password": "lopez2026",
  "full_name": "Juan López",
  "company_name": "Agrícola López S.A.",
  "phone": "614-555-1234"
}
→ 201: { "id": 1, "user_id": 2, "company_name": "Agrícola López S.A.", ... }
```

### Paso 3: Admin crea un predio para el cliente

```
POST /api/v1/properties
Header: Authorization: Bearer eyJ...
Body: { "client_id": 1, "name": "Rancho Norte", "location": "Km 5 Delicias" }
→ 201: { "id": 1, "client_id": 1, "name": "Rancho Norte", ... }
```

### Paso 4: Admin crea un área de riego en el predio

```
POST /api/v1/irrigation-areas
Header: Authorization: Bearer eyJ...
Body: { "property_id": 1, "crop_type_id": 1, "name": "Nogal Norte", "area_size": 15.5 }
→ 201: { "id": 1, "property_id": 1, "crop_type_id": 1, "name": "Nogal Norte", ... }
```

### Paso 5: Admin define un ciclo de cultivo

```
POST /api/v1/crop-cycles
Header: Authorization: Bearer eyJ...
Body: { "irrigation_area_id": 1, "start_date": "2026-02-01", "end_date": null }
→ 201: { "id": 1, "irrigation_area_id": 1, "start_date": "2026-02-01", "end_date": null, ... }
```

### Paso 6: Admin registra un nodo IoT y obtiene la API Key

```
POST /api/v1/nodes
Header: Authorization: Bearer eyJ...
Body: {
  "irrigation_area_id": 1,
  "name": "Sensor Nogal Norte",
  "serial_number": "SN-2026-001",
  "latitude": 28.1867530,
  "longitude": -105.4714920
}
→ 201: { "id": 1, "api_key": "ak_n01_a1b2c3d4e5f6g7h8", ... }
```

> El admin copia la `api_key` y la configura en el simulador.

### Paso 7: Simulador envía lecturas cada 10 min

```
POST /api/v1/readings
Header: X-API-Key: ak_n01_a1b2c3d4e5f6g7h8
Body: {
  "timestamp": "2026-03-05T10:30:00Z",
  "soil": { "conductivity": 2.5, "temperature": 22.3, "humidity": 45.6, "water_potential": -0.8 },
  "irrigation": { "active": true, "accumulated_liters": 1250.0, "flow_per_minute": 8.3 },
  "environmental": { "temperature": 28.1, "relative_humidity": 55.0, "wind_speed": 12.5, "solar_radiation": 650.0, "eto": 5.2 }
}
→ 201: { "id": 1001, "node_id": 1, "timestamp": "2026-03-05T10:30:00Z", ... }
```

### Paso 8: Cliente hace login y ve su dashboard

```
POST /api/v1/auth/login
Body: { "email": "jlopez@correo.com", "password": "lopez2026" }
→ 200: { "access_token": "eyJ...(cliente)...", ... }

GET /api/v1/readings/latest?irrigation_area_id=1
Header: Authorization: Bearer eyJ...(cliente)...
→ 200: { "timestamp": "2026-03-05T10:30:00Z", "soil": { "humidity": 45.6, ... }, ... }
```

### Paso 9: Cliente consulta el histórico del mes

```
GET /api/v1/readings?irrigation_area_id=1&start_date=2026-03-01&end_date=2026-03-05&page=1&per_page=50
Header: Authorization: Bearer eyJ...(cliente)...
→ 200: { "page": 1, "per_page": 50, "total": 720, "data": [...] }
```

### Paso 10: Cliente exporta los datos a Excel

```
GET /api/v1/readings/export?format=xlsx&irrigation_area_id=1&start_date=2026-03-01&end_date=2026-03-05
Header: Authorization: Bearer eyJ...(cliente)...
→ 200: archivo .xlsx para descarga
```

---

## 7. Referencia Rápida de Endpoints

### Auth (3 endpoints)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | — | Login |
| POST | `/api/v1/auth/refresh` | — | Renovar token |
| POST | `/api/v1/auth/logout` | JWT | Cerrar sesión |

### Users (5 endpoints) — Admin only

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/users` | Listar (paginado) |
| POST | `/api/v1/users` | Crear |
| GET | `/api/v1/users/{id}` | Detalle |
| PUT | `/api/v1/users/{id}` | Actualizar |
| DELETE | `/api/v1/users/{id}` | Eliminar |

### Clients (5 endpoints) — Admin only

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/clients` | Listar (paginado) |
| POST | `/api/v1/clients` | Crear (+ usuario) |
| GET | `/api/v1/clients/{id}` | Detalle |
| PUT | `/api/v1/clients/{id}` | Actualizar |
| DELETE | `/api/v1/clients/{id}` | Eliminar |

### Properties (5 endpoints) — Admin CRUD, Cliente GET

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/properties` | Listar (paginado, filtro: client_id) |
| POST | `/api/v1/properties` | Crear |
| GET | `/api/v1/properties/{id}` | Detalle |
| PUT | `/api/v1/properties/{id}` | Actualizar |
| DELETE | `/api/v1/properties/{id}` | Eliminar |

### Crop Types (5 endpoints) — Admin CRUD, todos GET

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/crop-types` | Listar (paginado) |
| POST | `/api/v1/crop-types` | Crear |
| GET | `/api/v1/crop-types/{id}` | Detalle |
| PUT | `/api/v1/crop-types/{id}` | Actualizar |
| DELETE | `/api/v1/crop-types/{id}` | Eliminar |

### Irrigation Areas (5 endpoints) — Admin CRUD, Cliente GET

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/irrigation-areas` | Listar (paginado, filtro: property_id) |
| POST | `/api/v1/irrigation-areas` | Crear |
| GET | `/api/v1/irrigation-areas/{id}` | Detalle |
| PUT | `/api/v1/irrigation-areas/{id}` | Actualizar |
| DELETE | `/api/v1/irrigation-areas/{id}` | Eliminar |

### Crop Cycles (5 endpoints) — Admin CRUD, Cliente GET

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/crop-cycles` | Listar (paginado, filtro: irrigation_area_id) |
| POST | `/api/v1/crop-cycles` | Crear |
| GET | `/api/v1/crop-cycles/{id}` | Detalle |
| PUT | `/api/v1/crop-cycles/{id}` | Actualizar |
| DELETE | `/api/v1/crop-cycles/{id}` | Eliminar |

### Nodes (5 endpoints) — Admin CRUD, Cliente GET

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/nodes` | Listar (paginado, filtro: irrigation_area_id) |
| POST | `/api/v1/nodes` | Registrar (genera API Key) |
| GET | `/api/v1/nodes/{id}` | Detalle |
| PUT | `/api/v1/nodes/{id}` | Actualizar |
| DELETE | `/api/v1/nodes/{id}` | Eliminar |

### Readings (4 endpoints)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/v1/readings` | API Key | Ingesta de sensor |
| GET | `/api/v1/readings` | JWT | Histórico (paginado, filtros: irrigation_area_id, dates, cycle) |
| GET | `/api/v1/readings/latest` | JWT | Última lectura (frescura) |
| GET | `/api/v1/readings/export` | JWT | Exportar CSV/XLSX/PDF |

**Total: 42 endpoints.**
