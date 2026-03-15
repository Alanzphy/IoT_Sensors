# Arquitectura del Sistema — IoT Riego Agrícola

> Documento de referencia visual de la arquitectura técnica del sistema.
> Contiene los diagramas de infraestructura, flujos de datos y autenticación para el **MVP (Fase 1)**, y un apéndice pre-redactado con la **expansión de Fase 2** listo para activar.

---

## Tabla de Contenidos

- [1. Diagrama de Arquitectura General (MVP)](#1-diagrama-de-arquitectura-general-mvp)
- [2. Flujo de Datos del Sensor](#2-flujo-de-datos-del-sensor)
- [3. Flujos de Autenticación](#3-flujos-de-autenticación)
- [4. Jerarquía de Entidades](#4-jerarquía-de-entidades)
- [5. Stack Tecnológico](#5-stack-tecnológico)
- [6. FASE 2 — Expansión de Arquitectura (pre-redactada)](#6-fase-2--expansión-de-arquitectura-pre-redactada)

---

## 1. Diagrama de Arquitectura General (MVP)

Este diagrama muestra **todos los componentes del sistema y cómo se comunican entre sí** en producción.

```mermaid
graph TD
    subgraph INTERNET["🌐 Internet"]
        Browser["🖥️ Browser<br/>(Admin / Cliente)"]
        Simulator["📡 Simulador<br/>(PC Local — Script Python)"]
    end

    subgraph VPS["🐸 VPS Linux — Servidor Grogu<br/>Docker Compose"]
        subgraph NGINX_BLOCK["Nginx — Reverse Proxy<br/>:80 / :443"]
            Nginx["⚡ Nginx"]
        end

        subgraph FRONTEND_BLOCK["Contenedor Frontend"]
            Frontend["⚛️ React SPA<br/>(build estático)"]
        end

        subgraph BACKEND_BLOCK["Contenedor Backend"]
            Backend["🐍 FastAPI + Uvicorn<br/>:5050"]
        end

        subgraph DB_BLOCK["Contenedor Base de Datos"]
            MySQL["🗄️ MySQL 8<br/>:3306"]
        end
    end

    %% --- Conexiones externas → Nginx ---
    Browser -->|"HTTPS :443<br/>JWT Bearer token"| Nginx
    Simulator -->|"HTTPS POST<br/>/api/v1/readings<br/>Header: X-API-Key"| Nginx

    %% --- Nginx rutea ---
    Nginx -->|"/ → static files"| Frontend
    Nginx -->|"/api/v1/* → :5050"| Backend

    %% --- Frontend ↔ Backend (vía Nginx) ---
    Frontend -.->|"REST API<br/>GET/POST/PUT/DELETE<br/>Authorization: Bearer"| Nginx

    %% --- Backend → BD ---
    Backend -->|"SQLAlchemy ORM<br/>:3306"| MySQL

    %% --- Estilos ---
    style INTERNET fill:#e3f2fd,stroke:#1565c0,color:#000
    style VPS fill:#f1f8e9,stroke:#33691e,color:#000
    style NGINX_BLOCK fill:#fff3e0,stroke:#e65100,color:#000
    style FRONTEND_BLOCK fill:#e8eaf6,stroke:#283593,color:#000
    style BACKEND_BLOCK fill:#fce4ec,stroke:#b71c1c,color:#000
    style DB_BLOCK fill:#f3e5f5,stroke:#4a148c,color:#000
```

**Resumen de puertos y protocolos:**

| Origen | Destino | Puerto | Protocolo / Ruta |
|--------|---------|--------|------------------|
| Browser | Nginx | 80 → 443 | HTTPS (redirect HTTP→HTTPS) |
| Simulador | Nginx | 443 | HTTPS POST `/api/v1/readings` |
| Nginx | Frontend | interno | `/` → archivos estáticos React |
| Nginx | Backend | 5050 | `/api/v1/*` → proxy pass |
| Backend | MySQL | 3306 | SQLAlchemy (conexión interna Docker) |

> **Nota:** El Frontend no se comunica directamente con el Backend. Toda petición pasa por Nginx, que actúa como reverse proxy.

---

## 2. Flujo de Datos del Sensor

Cómo viaja una lectura desde el simulador hasta la base de datos (cada 10 minutos por nodo).

```mermaid
sequenceDiagram
    participant S as 📡 Simulador
    participant N as ⚡ Nginx
    participant B as 🐍 Backend (FastAPI)
    participant DB as 🗄️ MySQL

    S->>N: POST /api/v1/readings<br/>Header: X-API-Key: <key><br/>Body: JSON (3 categorías)
    N->>B: Proxy pass → :5050

    B->>B: Validar API Key
    alt API Key inválida
        B-->>N: 401 Unauthorized
        N-->>S: 401 Unauthorized
    end

    B->>B: Validar payload JSON
    Note right of B: ✅ timestamp (ISO 8601 UTC)<br/>✅ soil (4 campos)<br/>✅ irrigation (3 campos)<br/>✅ environmental (5 campos)<br/>⚠️ Campos null/0 = aceptados<br/>❌ NDVI = ignorado

    alt Payload inválido
        B-->>N: 400 Bad Request
        N-->>S: 400 Bad Request
    end

    B->>DB: INSERT lecturas (marca_tiempo, nodo_id, + 12 variables de estado)
    B-->>N: 201 Created
    N-->>S: 201 Created
```

**Payload JSON enviado por el simulador:**

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

> Campos no disponibles se envían como `0` o `null`. El `timestamp` es obligatorio. Datos estáticos (GPS, cultivo, tamaño) **no** van en el payload.

---

## 3. Flujos de Autenticación

El sistema maneja **dos mecanismos de autenticación distintos**: uno para usuarios humanos y otro para nodos IoT.

### 3.1 Usuarios (Admin / Cliente) — JWT

```mermaid
sequenceDiagram
    participant U as 🖥️ Browser
    participant N as ⚡ Nginx
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL

    U->>N: POST /api/v1/auth/login<br/>{email, password}
    N->>B: Proxy pass → :5050
    B->>DB: SELECT usuario WHERE email = ?
    B->>B: Verificar password (bcrypt hash)

    alt Credenciales válidas
        B->>DB: INSERT token_refresco
        B-->>N: 200 OK<br/>{access_token, refresh_token}
        N-->>U: 200 OK
        Note right of U: Almacena tokens<br/>en memoria/localStorage
    else Credenciales inválidas
        B-->>N: 401 Unauthorized
        N-->>U: 401 Unauthorized
    end

    Note over U,B: --- Peticiones subsecuentes ---

    U->>N: GET /api/v1/properties<br/>Authorization: Bearer <access_token>
    N->>B: Proxy pass
    B->>B: Validar JWT (firma + expiración)
    B-->>N: 200 OK (datos)
    N-->>U: 200 OK

    Note over U,B: --- Cuando expira el access_token ---

    U->>N: POST /api/v1/auth/refresh<br/>{refresh_token}
    N->>B: Proxy pass
    B->>DB: Validar refresh_token
    B-->>N: 200 OK<br/>{nuevo access_token}
    N-->>U: 200 OK
```

### 3.2 Nodos IoT — API Key

```mermaid
sequenceDiagram
    participant S as 📡 Simulador
    participant N as ⚡ Nginx
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL

    Note right of S: API Key fija asignada<br/>al registrar el nodo

    S->>N: POST /api/v1/readings<br/>Header: X-API-Key: abc123...
    N->>B: Proxy pass → :5050
    B->>DB: SELECT nodo WHERE api_key = ?

    alt API Key válida
        B->>B: Asociar lectura al nodo encontrado
        B->>DB: INSERT lectura + datos categorías
        B-->>N: 201 Created
        N-->>S: 201 Created
    else API Key inválida / no existe
        B-->>N: 401 Unauthorized
        N-->>S: 401 Unauthorized
    end
```

**Comparativa rápida:**

| Aspecto | Usuarios (JWT) | Nodos IoT (API Key) |
|---------|---------------|---------------------|
| Header | `Authorization: Bearer <token>` | `X-API-Key: <key>` |
| Expiración | Access token expira (minutos), refresh renueva | No expira (key fija) |
| Flujo | Login → obtener tokens → enviar Bearer | Key asignada al registro → enviar siempre |
| Permisos | CRUD completo según rol (Admin/Cliente) | Solo POST `/api/v1/readings` (escritura) |

---

## 4. Jerarquía de Entidades

Cómo se organizan los datos del sistema de arriba hacia abajo. Esta jerarquía **define los permisos**: un Cliente solo ve lo que cuelga debajo de él.

```mermaid
graph TD
    U["👤 Usuario<br/>(Admin o Cliente)"]
    C["🏢 Cliente<br/>ej: Agrícola López S.A."]
    P["🏡 Predio<br/>ej: Rancho Norte"]
    AR["🌱 Área de Riego<br/>ej: Nogal Norte — 15.5 ha"]
    TC["📋 Tipo de Cultivo<br/>(catálogo administrable)<br/>ej: Nogal"]
    CC["📅 Ciclo de Cultivo<br/>ej: 2026-02-01 → ..."]
    ND["📡 Nodo IoT<br/>(relación 1:1 con Área)<br/>GPS: lat/lon"]
    ND -->|"1:N"| L["📊 Lecturas<br/>1 tabla plana con<br/>12 campos dinámicos"]

    style U fill:#e3f2fd,stroke:#1565c0,color:#000
    style C fill:#bbdefb,stroke:#1565c0,color:#000
    style P fill:#c8e6c9,stroke:#2e7d32,color:#000
    style AR fill:#a5d6a7,stroke:#2e7d32,color:#000
    style TC fill:#fff9c4,stroke:#f9a825,color:#000
    style CC fill:#ffe0b2,stroke:#e65100,color:#000
    style ND fill:#e1bee7,stroke:#6a1b9a,color:#000
    style L fill:#f8bbd0,stroke:#880e4f,color:#000
```

**Reglas clave:**
- El **Admin** puede ver y gestionar todo (CRUD completo).
- El **Cliente** solo ve sus propios predios, áreas y lecturas.
- Cada Área de Riego tiene **exactamente 1 Nodo** (relación 1:1).
- Cada Área puede tener **múltiples Ciclos de Cultivo** (historial de temporadas), pero solo **1 activo** a la vez.
- El **catálogo de tipos de cultivo** es administrable por el Admin. Valores iniciales: Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón.

---

## 5. Stack Tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| **Frontend** | React (SPA) | Interfaz web. Build estático servido por Nginx. Dashboard, histórico, exportación. |
| **Backend** | Python 3.11+ / FastAPI / Uvicorn | API REST. Recibe lecturas de sensores + atiende CRUD del frontend. Async. |
| **Base de Datos** | MySQL 8 | Almacenamiento relacional. 12 tablas. ORM: SQLAlchemy. Migraciones: Alembic. |
| **Reverse Proxy** | Nginx | Punto de entrada público. SSL termination. Rutea `/` → frontend, `/api/v1/*` → backend. |
| **Contenedores** | Docker + Docker Compose | Orquestación de 3 contenedores (Frontend+Nginx, Backend, MySQL) en la VPS. |
| **Servidor** | VPS Linux ("Servidor Grogu") | Infraestructura. Puertos expuestos: 80, 443. Internos: 5050, 3306. |

**Convenciones del API:**
- URLs en **inglés**, plural, versionadas: `/api/v1/clients`, `/api/v1/properties`, `/api/v1/readings`
- Paginación obligatoria en listados: `?page=1&per_page=50`
- Filtros de fecha: `?start_date=2026-01-01&end_date=2026-01-31`
- Exportación: `GET /api/v1/readings/export?format=csv|xlsx|pdf`

---
---

## 6. FASE 2 — Expansión de Arquitectura (pre-redactada)

> ⏳ **ESTA SECCIÓN NO ESTÁ IMPLEMENTADA.** Está pre-redactada para que, al iniciar la Fase 2, solo haya que activar los componentes — no redactar desde cero. Cada sub-sección incluye el diagrama, las tablas y los endpoints listos para integrar.

---

### 6.1 Diagrama de Arquitectura Expandida (Fase 2)

El diagrama del MVP con todos los componentes nuevos añadidos. **Cuando se active la Fase 2, este diagrama reemplaza al de la Sección 1.**

```mermaid
graph TD
    subgraph INTERNET["🌐 Internet"]
        Browser["🖥️ Browser<br/>(Admin / Cliente)"]
        Simulator["📡 Simulador<br/>(PC Local)"]
    end

    subgraph EXTERNAL["☁️ Servicios Externos"]
        AzureAI["🤖 Azure OpenAI<br/>[Fase 2]"]
        SMTP["📧 Servicio Email / SMTP<br/>[Fase 2]"]
        WhatsApp["📱 WhatsApp Business API<br/>[Fase 2]"]
        Maps["🗺️ API de Mapas<br/>(Google Maps)<br/>[Fase 2]"]
    end

    subgraph VPS["🐸 VPS Linux — Servidor Grogu<br/>Docker Compose"]
        subgraph NGINX_BLOCK["Nginx — Reverse Proxy<br/>:80 / :443"]
            Nginx["⚡ Nginx"]
        end

        subgraph FRONTEND_BLOCK["Contenedor Frontend"]
            Frontend["⚛️ React SPA"]
        end

        subgraph BACKEND_BLOCK["Contenedor Backend"]
            Backend["🐍 FastAPI + Uvicorn<br/>:5050"]
        end

        subgraph DB_BLOCK["Contenedor Base de Datos"]
            MySQL["🗄️ MySQL 8<br/>:3306"]
        end

        subgraph N8N_BLOCK["Contenedor n8n<br/>[Fase 2]"]
            N8N["🔄 n8n<br/>:5678"]
        end
    end

    %% --- Conexiones MVP (sin cambios) ---
    Browser -->|"HTTPS :443<br/>JWT Bearer"| Nginx
    Simulator -->|"HTTPS POST<br/>/api/v1/readings<br/>X-API-Key"| Nginx
    Nginx -->|"/ → static"| Frontend
    Nginx -->|"/api/v1/* → :5050"| Backend
    Frontend -.->|"REST API"| Nginx
    Backend -->|"SQLAlchemy :3306"| MySQL

    %% --- Conexiones FASE 2 ---
    Backend -->|"Chat IA en tiempo real<br/>Function Calling<br/>[Fase 2]"| AzureAI
    N8N -->|"Extracción masiva<br/>GET /api/v1/readings<br/>[Fase 2]"| Backend
    N8N -->|"Análisis nocturno<br/>reportes + anomalías<br/>[Fase 2]"| AzureAI
    Backend -->|"Alertas + Recovery<br/>[Fase 2]"| SMTP
    Backend -->|"Alertas críticas<br/>[Fase 2]"| WhatsApp
    Frontend -->|"Mapa interactivo<br/>GPS predios/nodos<br/>[Fase 2]"| Maps

    %% --- Estilos MVP ---
    style INTERNET fill:#e3f2fd,stroke:#1565c0,color:#000
    style VPS fill:#f1f8e9,stroke:#33691e,color:#000
    style NGINX_BLOCK fill:#fff3e0,stroke:#e65100,color:#000
    style FRONTEND_BLOCK fill:#e8eaf6,stroke:#283593,color:#000
    style BACKEND_BLOCK fill:#fce4ec,stroke:#b71c1c,color:#000
    style DB_BLOCK fill:#f3e5f5,stroke:#4a148c,color:#000

    %% --- Estilos Fase 2 (diferenciados) ---
    style EXTERNAL fill:#fff8e1,stroke:#ff8f00,color:#000
    style N8N_BLOCK fill:#fff8e1,stroke:#ff8f00,color:#000
```

---

### 6.2 Nuevas Tablas de Base de Datos

Tablas que se agregan en Fase 2. Se conectan a las tablas existentes del MVP.

```mermaid
erDiagram
    areas_riego ||--o{ umbrales : "1:N"
    nodos ||--o{ alertas : "1:N"
    umbrales ||--o{ alertas : "1:N"
    usuarios ||--o{ audit_log : "1:N"

    umbrales {
        BIGINT id PK
        BIGINT area_riego_id FK
        VARCHAR parametro "ej: soil.humidity"
        DECIMAL rango_min "ej: 20.0"
        DECIMAL rango_max "ej: 30.0"
        VARCHAR severidad "info | warning | critical"
        DATETIME creado_en
        DATETIME actualizado_en
    }

    alertas {
        BIGINT id PK
        BIGINT nodo_id FK
        BIGINT umbral_id FK
        VARCHAR parametro "ej: soil.humidity"
        DECIMAL valor_detectado "ej: 8.5"
        VARCHAR severidad "info | warning | critical"
        BOOLEAN leida "default false"
        BOOLEAN notificada_email "default false"
        BOOLEAN notificada_whatsapp "default false"
        DATETIME marca_tiempo
        DATETIME creado_en
    }

    audit_log {
        BIGINT id PK
        BIGINT usuario_id FK
        VARCHAR accion "CREATE | UPDATE | DELETE"
        VARCHAR entidad "ej: predios"
        BIGINT entidad_id
        JSON datos_anteriores "nullable"
        JSON datos_nuevos "nullable"
        DATETIME creado_en
    }
```

**Migraciones Alembic necesarias:**
- `alembic revision --autogenerate -m "add_umbrales_table"`
- `alembic revision --autogenerate -m "add_alertas_table"`
- `alembic revision --autogenerate -m "add_audit_log_table"`
- (Opcional) `alembic revision -m "add_ndvi_field"` — si se define la fuente de datos.

---

### 6.3 Nuevos Endpoints de API

| Módulo | Método | Endpoint | Descripción |
|--------|--------|----------|-------------|
| **Umbrales** | GET | `/api/v1/thresholds?irrigation_area_id=` | Listar umbrales de un área |
| | POST | `/api/v1/thresholds` | Crear umbral |
| | PUT | `/api/v1/thresholds/{id}` | Editar umbral |
| | DELETE | `/api/v1/thresholds/{id}` | Eliminar umbral |
| **Alertas** | GET | `/api/v1/alerts?node_id=&severity=&read=` | Listar alertas con filtros |
| | GET | `/api/v1/alerts/{id}` | Detalle de alerta |
| | PATCH | `/api/v1/alerts/{id}/read` | Marcar alerta como leída |
| **Auditoría** | GET | `/api/v1/audit-logs?user_id=&entity=&start_date=&end_date=` | Listar logs (solo Admin) |
| **Chat IA** | POST | `/api/v1/chat` | Enviar pregunta → respuesta IA |
| **Recuperación** | POST | `/api/v1/auth/forgot-password` | Solicitar email de recuperación |
| | POST | `/api/v1/auth/reset-password` | Resetear contraseña con token |

---

### 6.4 Flujo de Alertas por Umbrales

Cuando llega una lectura, el backend compara los valores contra los umbrales configurados y genera alertas si están fuera de rango.

```mermaid
sequenceDiagram
    participant S as 📡 Simulador
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL
    participant E as 📧 Email (SMTP)
    participant W as 📱 WhatsApp API

    S->>B: POST /api/v1/readings<br/>(flujo normal del MVP)
    B->>DB: INSERT lectura + categorías

    B->>DB: SELECT umbrales<br/>WHERE area_riego_id = ?

    loop Por cada umbral configurado
        B->>B: Comparar valor vs rango<br/>ej: humidity=8.5 vs min=20
        alt Valor fuera de rango
            B->>DB: INSERT alerta<br/>(nodo_id, parámetro, valor, severidad)

            alt Usuario tiene email activado
                B->>E: Enviar notificación email
                B->>DB: UPDATE alerta SET notificada_email=true
            end

            alt Severidad=critical AND WhatsApp activado
                B->>W: Enviar notificación WhatsApp
                B->>DB: UPDATE alerta SET notificada_whatsapp=true
            end
        end
    end

    B-->>S: 201 Created
```

---

### 6.5 Flujos de Inteligencia Artificial

#### A) Chat Interactivo en Tiempo Real

El usuario hace una pregunta en lenguaje natural y la IA responde usando datos del sistema.

```mermaid
sequenceDiagram
    participant U as 🖥️ Browser
    participant B as 🐍 Backend
    participant AI as 🤖 Azure OpenAI
    participant DB as 🗄️ MySQL

    U->>B: POST /api/v1/chat<br/>{message: "¿Cuál es la humedad<br/>promedio del Nogal Norte<br/>esta semana?"}

    B->>AI: Chat Completion<br/>+ Function Definitions<br/>(get_readings, get_area_info...)

    AI->>AI: Decide llamar función<br/>get_readings(area=Nogal Norte,<br/>last_7_days)

    AI-->>B: Function Call request

    B->>DB: SELECT AVG(humidity)<br/>FROM lecturas_suelo<br/>WHERE ... last 7 days
    DB-->>B: 32.4

    B->>AI: Function result: {avg_humidity: 32.4}

    AI-->>B: "La humedad promedio del<br/>Nogal Norte esta semana es<br/>32.4%. Está dentro del rango<br/>óptimo (20-40%)."

    B-->>U: 200 OK<br/>{response: "La humedad promedio..."}
```

#### B) Análisis Nocturno Automatizado (n8n)

Tareas programadas que extraen datos masivos, los analizan con IA, y generan reportes o alertas tempranas.

```mermaid
sequenceDiagram
    participant CRON as ⏰ n8n (Cron Trigger)
    participant B as 🐍 Backend API
    participant AI as 🤖 Azure OpenAI
    participant DB as 🗄️ MySQL

    Note over CRON: Ejecución nocturna<br/>ej: 02:00 AM diario

    CRON->>B: GET /api/v1/readings<br/>?start_date=ayer&end_date=hoy<br/>&per_page=10000

    B->>DB: SELECT lecturas masivas
    DB-->>B: N registros
    B-->>CRON: JSON con lecturas del día

    CRON->>AI: Analizar datos:<br/>"Busca patrones, anomalías,<br/>tendencias en estas lecturas..."

    AI-->>CRON: Análisis:<br/>"Nodo #3 muestra descenso<br/>sostenido de humedad (45→12%)<br/>en 6 horas. Posible riego<br/>insuficiente."

    alt Se detectó anomalía
        CRON->>B: POST /api/v1/alerts<br/>{tipo: "ai_analysis", ...}
        B->>DB: INSERT alerta
    end

    CRON->>CRON: Generar reporte PDF/email
    CRON->>B: Notificar al cliente<br/>(email con resumen del día)
```

---

### 6.6 Flujo de Inactividad de Nodo (Alerta Activa)

En el MVP, la "frescura de datos" es un indicador pasivo en el frontend. En Fase 2, el backend genera una alerta activa.

```mermaid
sequenceDiagram
    participant CRON as ⏰ Backend (Cron/Scheduler)
    participant DB as 🗄️ MySQL
    participant E as 📧 Email

    Note over CRON: Cada 5 minutos<br/>(background task)

    CRON->>DB: SELECT nodos<br/>WHERE última_lectura < NOW() - 20min

    loop Por cada nodo inactivo
        CRON->>DB: SELECT alerta existente<br/>WHERE nodo_id=? AND tipo='inactividad'<br/>AND no resuelta

        alt No existe alerta previa
            CRON->>DB: INSERT alerta<br/>(tipo: inactividad, nodo_id,<br/>severidad: warning)
            CRON->>E: Notificar al cliente<br/>"Nodo X sin datos desde hace 20+ min"
        end
    end
```

---

### 6.7 Checklist de Activación — Fase 2

Pasos concretos para integrar cada módulo. Marcar conforme se vayan completando.

#### Infraestructura
- [ ] Agregar contenedor **n8n** al `docker-compose.yml` (puerto 5678, volumen para workflows)
- [ ] Configurar **Azure OpenAI** (API key, endpoint, modelo en variables de entorno)
- [ ] Configurar **servicio SMTP** (host, puerto, credenciales en variables de entorno)
- [ ] Configurar **WhatsApp Business API** (token, número, en variables de entorno)
- [ ] Agregar **Google Maps API key** al frontend (variable de entorno del build)

#### Base de Datos
- [ ] Ejecutar migración Alembic: tabla `umbrales`
- [ ] Ejecutar migración Alembic: tabla `alertas`
- [ ] Ejecutar migración Alembic: tabla `audit_log`
- [ ] (Opcional) Migración para campo NDVI si se define la fuente de datos

#### Backend — Endpoints
- [ ] Implementar CRUD `/api/v1/thresholds` (umbrales por área)
- [ ] Implementar `/api/v1/alerts` (listado, detalle, marcar como leída)
- [ ] Implementar `/api/v1/audit-logs` (solo Admin)
- [ ] Implementar `/api/v1/chat` (proxy a Azure OpenAI con Function Calling)
- [ ] Implementar `/api/v1/auth/forgot-password` y `/api/v1/auth/reset-password`
- [ ] Agregar lógica de comparación lectura vs umbrales al flujo de ingesta (POST readings)
- [ ] Agregar background task para detección de nodos inactivos (≥20 min sin datos)
- [ ] Integrar envío de email (alertas + recuperación de contraseña)
- [ ] Integrar envío de WhatsApp (alertas críticas)
- [ ] Agregar middleware de auditoría (log de acciones CRUD al `audit_log`)

#### Frontend
- [ ] Componente de chat IA (interfaz conversacional)
- [ ] Vista de alertas (listado, filtros, marcar como leída)
- [ ] Configuración de umbrales por área (formulario)
- [ ] Visualización geoespacial con Google Maps (mapa de predios/nodos)
- [ ] Flujo de "Olvidé mi contraseña" (formulario + pantalla de reset)
- [ ] Indicadores de color por umbrales en dashboard (verde/amarillo/rojo)
- [ ] Vista de auditoría para Admin

#### Documentación
- [ ] Actualizar diagrama de arquitectura: reemplazar Sección 1 con diagrama de Sección 6.1
- [ ] Actualizar SRS: reincorporar REQs de Fase 2 como activos
- [ ] Actualizar casos de uso: nuevos flujos de alertas, umbrales, chat IA
- [ ] Actualizar diagramas de actividad: agregar flujos de alertas, IA, recuperación de contraseña
- [ ] Eliminar esta sección (6) o marcarla como "✅ ACTIVADA"
