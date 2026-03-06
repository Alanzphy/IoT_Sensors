# ROL Y OBJETIVO
Actúa como un Arquitecto de Software Senior y experto en UML. Tu objetivo es ayudarme a diseñar los Diagramas de Actividad para un sistema web IoT de riego agrícola, basándote estrictamente en la arquitectura técnica y el plan de prioridades definido a continuación.

# 1. CONTEXTO TÉCNICO (MVP)
- **Infraestructura:** Servidor "Grogu" montado en una VPS Linux (8GB RAM).
- **Módulo de Control (Simulador):** Script en una PC local que envía peticiones HTTP POST cada **10 minutos** (144 lecturas/día por nodo) simulando el hardware físico. Cada petición envía un **payload JSON** con las **3 categorías dinámicas** de datos: Suelo (4 campos), Riego (3 campos: active, accumulated_liters, flow_per_minute), Ambiental (5 campos). **12 campos dinámicos** por lectura. Los datos "Generales" (Cultivo, Tamaño, GPS) son estáticos y NO van en el payload. Campos no disponibles se envían como `0` o `null`. NDVI está **excluido** del MVP. El nodo se autentica con API Key fija (`X-API-Key` header).
- **Backend (Puerto 5050):** Python/FastAPI. API REST que recibe los datos del simulador (POST a `/api/v1/readings`) y atiende las peticiones CRUD de la Web App. Auth: JWT para usuarios, API Key para nodos.
- **Base de Datos (Puerto 3306):** MySQL 8. Relacional. Jerarquía de entidades:
  - **Cliente** → **Predios** → **Áreas de Riego** → **Cultivo** (del catálogo administrable) → **Nodo IoT** (relación 1:1 con Área)
  - Catálogo administrable de cultivos: **Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón** (valores iniciales, el Admin puede agregar/editar/eliminar).
  - Cada área puede tener **múltiples Ciclos de Cultivo** (historial de temporadas). Solo 1 activo a la vez.
  - Cada lectura lleva **timestamp** obligatorio (ISO 8601 UTC) para consultas por rango de fechas.
- **Frontend:** React (SPA). Dashboard multicategoría con datos prioritarios (Humedad de suelo, Flujo de agua, E.T.O.), indicador de frescura de datos, histórico con filtros (rango libre, semana/mes/año, ciclo de cultivo), y exportación (CSV/Excel/PDF).
- **Deployment:** Docker + Docker Compose. Contenedores: MySQL, Backend (FastAPI + Uvicorn), Frontend (Nginx).
- **Regla Estricta:** El MVP NO incluye Inteligencia Artificial, agentes autónomos ni n8n en su lógica central. La base de datos debe estar normalizada y tener trazabilidad para soportar estas funciones en una Fase 2.

# 2. PLAN DE DIAGRAMAS DE ACTIVIDAD
Nos enfocaremos primero en los flujos críticos (Esenciales) y dejaremos los flujos estándar (Genéricos) para el final o los simplificaremos.

**Esenciales (Prioridad Alta):**
1. **Transmitir Lectura de Sensor** — POST desde el simulador al Backend (`/api/v1/readings` con `X-API-Key` header). Validar payload: verificar presencia de las **3 categorías dinámicas** (soil, irrigation, environmental), aceptar valores `0`/`null` para campos no disponibles, verificar que el `timestamp` esté presente (ISO 8601), rechazar/ignorar NDVI si se envía. Riego tiene 3 campos (active bool, accumulated_liters, flow_per_minute). Guardar la lectura con todos sus campos en la BD.
2. **Consultar Histórico y Filtrar Datos** — GET desde Frontend al Backend. Validación de pertenencia (el Cliente solo ve sus predios/áreas). Soportar filtros por: rango libre de fechas, presets (semana/mes/año), ciclo de cultivo (inicio/fin). Incluir indicador de frescura (último timestamp + tiempo transcurrido) cuando no hay datos recientes.
3. **Vincular Nodo a Área de Riego** — Validar la cadena completa: Predio existe → Área existe dentro del predio → Cultivo asignado del catálogo → Nodo no está ya asignado a otra área (relación 1:1). Configurar datos estáticos del nodo: GPS (latitud/longitud) y tamaño del área.
4. **Visualizar Dashboard Multicategoría** — Flujo de carga del dashboard: obtener datos del nodo asignado al área seleccionada, mostrar las 3 categorías dinámicas con énfasis visual en datos prioritarios (Humedad de suelo, Flujo de agua, E.T.O.), manejar el caso de "sin datos" mostrando indicador de frescura (último timestamp + tiempo transcurrido sin actualización).
5. **Gestionar Predios y Áreas de Riego** — CRUD de predios (asignar a cliente) y áreas de riego dentro de predios (asignar cultivo del catálogo administrable, definir ciclo de cultivo con fecha inicio/fin).

**Genéricos (Prioridad Baja):**
- Autenticación (Login/Logout).
- Gestión de Clientes (CRUD estándar).
- Exportar Datos (Acción local en Frontend con datos previamente filtrados).

# 3. REGLAS DE RESPUESTA
Cuando te pida generar un diagrama de actividad, debes cumplir con lo siguiente:
- Utiliza **Mermaid.js** (`graph TD` o `stateDiagram-v2`) para que pueda visualizarlo directamente.
- Detalla la interacción entre los componentes técnicos (Simulador, Frontend, Backend, Base de Datos).
- Incluye validaciones lógicas importantes (ej. verificar si el nodo existe, si el usuario tiene permisos, si el área ya tiene un nodo asignado).
- Menciona los códigos de estado HTTP relevantes en las respuestas del Backend (ej. 200 OK, 400 Bad Request, 401 Unauthorized).
- En diagramas que involucren el payload del sensor, incluye la validación de campos: qué categorías se aceptan, cómo se manejan valores `0`/`null`, que NDVI se ignora/rechaza.
- En diagramas de visualización, incluye el manejo de "sin datos" con indicador de frescura (último timestamp + tiempo transcurrido).
- Espera a que yo te indique qué diagrama específico vamos a trabajar. No generes todos a la vez.

---

# 4. DIAGRAMAS DE ACTIVIDAD — ESENCIALES

## 4.1 Transmitir Lectura de Sensor

Flujo completo desde que el simulador envía un POST hasta que se almacena en BD.

```mermaid
flowchart TD
    A([Simulador envía HTTP POST<br>/api/v1/readings]) --> B{¿Header X-API-Key<br>presente?}
    B -- No --> C[Responder 401 Unauthorized]
    B -- Sí --> D[Buscar nodo por api_key<br>WHERE api_key = ? AND eliminado_en IS NULL]
    D --> E{¿Nodo encontrado<br>y activo?}
    E -- No --> F[Responder 401 Unauthorized<br>API Key inválida o nodo inactivo]
    E -- Sí --> G{¿Body JSON válido?<br>timestamp presente ISO 8601}
    G -- No --> H[Responder 400 Bad Request<br>Payload inválido]
    G -- Sí --> I{¿Contiene las 3 categorías?<br>soil, irrigation, environmental}
    I -- No --> J[Responder 400 Bad Request<br>Categorías faltantes]
    I -- Sí --> K[Ignorar campo NDVI si viene<br>Aceptar campos 0 o null]
    K --> L[Iniciar transacción atómica]
    L --> M[INSERT lecturas<br>nodo_id + marca_tiempo]
    M --> N[INSERT lecturas_suelo<br>conductividad, temperatura,<br>humedad, potencial_hidrico]
    N --> O[INSERT lecturas_riego<br>activo, litros_acumulados,<br>flujo_por_minuto]
    O --> P[INSERT lecturas_ambiental<br>temperatura, humedad_relativa,<br>velocidad_viento, radiacion_solar, eto]
    P --> Q{¿Todos los INSERTs<br>exitosos?}
    Q -- No --> R[ROLLBACK transacción<br>Responder 500 Internal Server Error]
    Q -- Sí --> S[COMMIT transacción]
    S --> T[Responder 201 Created<br>lectura_id + marca_tiempo]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style F fill:#f44336,color:#fff
    style H fill:#ff9800,color:#fff
    style J fill:#ff9800,color:#fff
    style R fill:#f44336,color:#fff
    style T fill:#2196F3,color:#fff
```

---

## 4.2 Consultar Histórico y Filtrar Datos

Flujo desde que el usuario solicita datos históricos hasta que recibe la respuesta paginada.

```mermaid
flowchart TD
    A([Usuario accede a<br>Histórico en Frontend]) --> B[Frontend resuelve presets<br>semana/mes/año → start_date + end_date]
    B --> C[GET /api/v1/readings<br>?start_date=...&end_date=...<br>&irrigation_area_id=...&page=1&per_page=50]
    C --> D{¿JWT válido en<br>Authorization header?}
    D -- No --> E[Responder 401 Unauthorized]
    D -- Sí --> F[Extraer usuario_id y rol del JWT]
    F --> G{¿Rol = admin?}
    G -- Sí --> H[Acceso total:<br>cualquier área/predio]
    G -- No --> I{¿El área solicitada<br>pertenece al cliente?}
    I -- No --> J[Responder 403 Forbidden<br>Sin acceso a este recurso]
    I -- Sí --> H
    H --> K{¿Filtro por ciclo<br>de cultivo?}
    K -- Sí --> L[Obtener fecha_inicio y fecha_fin<br>del ciclo seleccionado]
    L --> M[Usar fechas del ciclo<br>como start_date/end_date]
    K -- No --> M
    M --> N[Obtener nodo_id del<br>área de riego — relación 1:1]
    N --> O[Query: lecturas + JOINs 3 categorías<br>WHERE nodo_id AND marca_tiempo BETWEEN<br>ORDER BY marca_tiempo ASC<br>LIMIT/OFFSET paginación]
    O --> P{¿Hay resultados?}
    P -- No --> Q[Responder 200 OK<br>data: lista vacía, total: 0]
    P -- Sí --> R[Responder 200 OK<br>data: lecturas paginadas<br>page, per_page, total]

    style A fill:#4CAF50,color:#fff
    style E fill:#f44336,color:#fff
    style J fill:#f44336,color:#fff
    style Q fill:#ff9800,color:#fff
    style R fill:#2196F3,color:#fff
```

---

## 4.3 Vincular Nodo a Área de Riego

Flujo de registro y vinculación de un nodo IoT a un área de riego (solo Admin).

```mermaid
flowchart TD
    A([Admin solicita vincular<br>Nodo a Área de Riego]) --> B{¿JWT válido y<br>rol = admin?}
    B -- No --> C[Responder 401/403]
    B -- Sí --> D[POST /api/v1/nodes<br>nombre, numero_serie, latitud,<br>longitud, area_riego_id]
    D --> E{¿El predio existe y<br>no está eliminado?}
    E -- No --> F[Responder 404 Not Found<br>Predio no encontrado]
    E -- Sí --> G{¿El área de riego existe<br>dentro del predio?}
    G -- No --> H[Responder 404 Not Found<br>Área no encontrada en predio]
    G -- Sí --> I{¿El área ya tiene<br>un tipo de cultivo asignado?}
    I -- No --> J[Responder 400 Bad Request<br>Área sin cultivo configurado]
    I -- Sí --> K{¿El área ya tiene<br>un nodo asignado?}
    K -- Sí --> L[Responder 409 Conflict<br>Área ya tiene nodo — relación 1:1]
    K -- No --> M{¿El numero_serie ya<br>existe en otro nodo?}
    M -- Sí --> N[Responder 409 Conflict<br>Número de serie duplicado]
    M -- No --> O[Generar API Key única<br>uuid4 o secrets.token_urlsafe]
    O --> P[INSERT nodos<br>nombre, numero_serie, api_key,<br>latitud, longitud, area_riego_id]
    P --> Q[Responder 201 Created<br>nodo_id + api_key generada]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style F fill:#f44336,color:#fff
    style H fill:#f44336,color:#fff
    style J fill:#ff9800,color:#fff
    style L fill:#ff9800,color:#fff
    style N fill:#ff9800,color:#fff
    style Q fill:#2196F3,color:#fff
```

---

## 4.4 Visualizar Dashboard Multicategoría

Flujo de carga del dashboard con datos prioritarios e indicador de frescura.

```mermaid
flowchart TD
    A([Usuario selecciona<br>Predio → Área de Riego]) --> B{¿JWT válido?}
    B -- No --> C[Redirigir a Login]
    B -- Sí --> D{¿Rol = admin<br>o área pertenece al cliente?}
    D -- No --> E[Mostrar error:<br>Sin acceso]
    D -- Sí --> F[GET /api/v1/readings/latest<br>?irrigation_area_id=...]
    F --> G[Backend: Obtener nodo_id<br>del área — relación 1:1]
    G --> H{¿El área tiene<br>nodo asignado?}
    H -- No --> I[Responder 200 OK<br>data: null, message: Sin nodo asignado]
    H -- Sí --> J[Query: última lectura del nodo<br>SELECT ... ORDER BY marca_tiempo DESC LIMIT 1<br>+ JOINs 3 categorías]
    J --> K{¿Hay lectura<br>disponible?}
    K -- No --> L[Responder 200 OK<br>data: null, message: Sin lecturas]
    K -- Sí --> M[Calcular tiempo transcurrido:<br>NOW - marca_tiempo última lectura]
    M --> N[Responder 200 OK con:]
    N --> N1["— Datos Suelo: conductividad,<br>temp, humedad ⭐, potencial hídrico"]
    N --> N2["— Datos Riego: activo,<br>litros acum., flujo/min ⭐"]
    N --> N3["— Datos Ambiental: temp, H.R.,<br>viento, radiación, E.T.O. ⭐"]
    N --> N4["— Frescura: último timestamp<br>+ tiempo transcurrido"]
    N1 --> O[Frontend renderiza Dashboard]
    N2 --> O
    N3 --> O
    N4 --> O
    O --> P["Mostrar con prominencia visual:<br>⭐ Humedad suelo (%)<br>⭐ Flujo agua (L/min)<br>⭐ E.T.O. (mm/día)"]
    P --> Q{¿Tiempo transcurrido<br>> 10 min?}
    Q -- Sí --> R["Mostrar indicador de frescura:<br>⚠️ Último dato: hace X min/horas"]
    Q -- No --> S["Indicador normal:<br>✅ Datos actualizados"]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style E fill:#f44336,color:#fff
    style I fill:#ff9800,color:#fff
    style L fill:#ff9800,color:#fff
    style R fill:#FF9800,color:#fff
    style S fill:#4CAF50,color:#fff
```

---

## 4.5 Gestionar Predios y Áreas de Riego

Flujo CRUD de predios y áreas de riego (solo Admin). Se muestra el flujo de creación que es el más complejo.

```mermaid
flowchart TD
    A([Admin accede a<br>Gestión de Predios/Áreas]) --> B{¿JWT válido y<br>rol = admin?}
    B -- No --> C[Responder 401/403]
    B -- Sí --> D{¿Operación?}

    D -- Crear Predio --> E1[POST /api/v1/properties<br>nombre, ubicacion, client_id]
    E1 --> F1{¿Cliente existe y<br>no está eliminado?}
    F1 -- No --> G1[Responder 404 Not Found]
    F1 -- Sí --> H1[INSERT predios]
    H1 --> I1[Responder 201 Created]

    D -- Crear Área --> E2[POST /api/v1/irrigation-areas<br>nombre, tamano_area,<br>tipo_cultivo_id, predio_id]
    E2 --> F2{¿Predio existe?}
    F2 -- No --> G2[Responder 404 Not Found]
    F2 -- Sí --> H2{¿Tipo de cultivo existe<br>en catálogo y no eliminado?}
    H2 -- No --> I2[Responder 404 Not Found<br>Tipo de cultivo no válido]
    H2 -- Sí --> J2[INSERT areas_riego]
    J2 --> K2[Responder 201 Created]

    D -- Definir Ciclo --> E3[POST /api/v1/crop-cycles<br>area_riego_id, fecha_inicio,<br>fecha_fin opcional]
    E3 --> F3{¿Área existe?}
    F3 -- No --> G3[Responder 404 Not Found]
    F3 -- Sí --> H3{¿Ya hay un ciclo activo<br>para esta área?<br>fecha_fin IS NULL o futura}
    H3 -- Sí --> I3[Responder 409 Conflict<br>Ya existe ciclo activo]
    H3 -- No --> J3[INSERT ciclos_cultivo]
    J3 --> K3[Responder 201 Created]

    D -- Soft Delete --> E4[DELETE /api/v1/properties/:id<br>o /irrigation-areas/:id]
    E4 --> F4[Marcar eliminado_en = NOW<br>en entidad + hijos en cascada]
    F4 --> G4[Responder 200 OK]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style G1 fill:#f44336,color:#fff
    style G2 fill:#f44336,color:#fff
    style I2 fill:#f44336,color:#fff
    style G3 fill:#f44336,color:#fff
    style I3 fill:#ff9800,color:#fff
    style I1 fill:#2196F3,color:#fff
    style K2 fill:#2196F3,color:#fff
    style K3 fill:#2196F3,color:#fff
    style G4 fill:#2196F3,color:#fff
```

---

# 5. DIAGRAMAS DE ACTIVIDAD — GENÉRICOS

## 5.1 Autenticación (Login / Logout)

```mermaid
flowchart TD
    A([Usuario accede a<br>pantalla de Login]) --> B[Ingresa correo<br>y contraseña]
    B --> C[POST /api/v1/auth/login<br>email + password]
    C --> D{¿Usuario existe<br>y está activo?}
    D -- No --> E[Responder 401 Unauthorized<br>Credenciales inválidas]
    D -- Sí --> F{¿Contraseña coincide<br>con bcrypt hash?}
    F -- No --> E
    F -- Sí --> G[Generar access_token JWT<br>con usuario_id, rol, exp]
    G --> H[Generar refresh_token<br>INSERT en tokens_refresco]
    H --> I[Responder 200 OK<br>access_token + refresh_token]
    I --> J[Frontend almacena tokens<br>y redirige al Dashboard]

    K([Token expirado]) --> L[POST /api/v1/auth/refresh<br>refresh_token]
    L --> M{¿Refresh token existe,<br>no expirado y no revocado?}
    M -- No --> N[Responder 401<br>Redirigir a Login]
    M -- Sí --> O[Generar nuevo access_token]
    O --> P[Responder 200 OK<br>nuevo access_token]

    Q([Usuario hace Logout]) --> R[POST /api/v1/auth/logout]
    R --> S[Marcar refresh_token<br>como revocado — revocado_en = NOW]
    S --> T[Responder 200 OK]
    T --> U[Frontend limpia tokens<br>y redirige a Login]

    style A fill:#4CAF50,color:#fff
    style E fill:#f44336,color:#fff
    style I fill:#2196F3,color:#fff
    style N fill:#f44336,color:#fff
    style P fill:#2196F3,color:#fff
    style U fill:#607D8B,color:#fff
```

---

## 5.2 Gestión de Clientes (CRUD)

```mermaid
flowchart TD
    A([Admin accede a<br>Gestión de Clientes]) --> B{¿JWT válido y<br>rol = admin?}
    B -- No --> C[Responder 401/403]
    B -- Sí --> D{¿Operación?}

    D -- Listar --> E1[GET /api/v1/clients<br>?page=1&per_page=50]
    E1 --> F1[Query: clientes WHERE eliminado_en IS NULL<br>JOIN usuarios para email/nombre<br>con paginación]
    F1 --> G1[Responder 200 OK<br>lista paginada]

    D -- Crear --> E2[POST /api/v1/clients<br>nombre_empresa, correo, contraseña,<br>teléfono, dirección]
    E2 --> F2{¿Correo ya existe<br>en usuarios?}
    F2 -- Sí --> G2[Responder 409 Conflict<br>Correo duplicado]
    F2 -- No --> H2[Transacción atómica:<br>1. INSERT usuarios — rol=cliente, hash bcrypt<br>2. INSERT clientes — usuario_id FK]
    H2 --> I2[Responder 201 Created]

    D -- Actualizar --> E3[PUT /api/v1/clients/:id<br>campos a actualizar]
    E3 --> F3{¿Cliente existe y<br>no eliminado?}
    F3 -- No --> G3[Responder 404 Not Found]
    F3 -- Sí --> H3[UPDATE clientes + usuarios<br>actualizado_en = NOW]
    H3 --> I3[Responder 200 OK]

    D -- Eliminar --> E4[DELETE /api/v1/clients/:id]
    E4 --> F4{¿Cliente existe?}
    F4 -- No --> G4[Responder 404 Not Found]
    F4 -- Sí --> H4["Soft delete en cascada:<br>cliente.eliminado_en = NOW<br>→ predios.eliminado_en = NOW<br>→ areas.eliminado_en = NOW<br>→ nodos.eliminado_en = NOW<br>→ usuario.activo = false"]
    H4 --> I4[Responder 200 OK]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style G1 fill:#2196F3,color:#fff
    style G2 fill:#ff9800,color:#fff
    style I2 fill:#2196F3,color:#fff
    style G3 fill:#f44336,color:#fff
    style I3 fill:#2196F3,color:#fff
    style G4 fill:#f44336,color:#fff
    style I4 fill:#2196F3,color:#fff
```

---

## 5.3 Exportar Datos Filtrados

```mermaid
flowchart TD
    A([Usuario solicita exportar<br>datos desde Histórico]) --> B{¿JWT válido?}
    B -- No --> C[Redirigir a Login]
    B -- Sí --> D{¿Rol = admin<br>o área pertenece al cliente?}
    D -- No --> E[Responder 403 Forbidden]
    D -- Sí --> F[Frontend envía:<br>GET /api/v1/readings/export<br>?format=csv&start_date=...&end_date=...<br>&irrigation_area_id=...]
    F --> G{¿Formato válido?<br>csv, xlsx o pdf}
    G -- No --> H[Responder 400 Bad Request<br>Formato no soportado]
    G -- Sí --> I[Query: lecturas filtradas<br>mismos filtros que Histórico<br>SIN paginación — todos los registros]
    I --> J{¿Hay datos?}
    J -- No --> K[Responder 204 No Content<br>o archivo vacío con encabezados]
    J -- Sí --> L{¿Formato?}
    L -- CSV --> M1[Generar archivo CSV<br>con librería csv de Python]
    L -- XLSX --> M2[Generar archivo Excel<br>con openpyxl]
    L -- PDF --> M3[Generar archivo PDF<br>con reportlab o weasyprint]
    M1 --> N[Responder 200 OK<br>Content-Disposition: attachment<br>Content-Type correspondiente]
    M2 --> N
    M3 --> N
    N --> O[Frontend descarga<br>el archivo al dispositivo]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style E fill:#f44336,color:#fff
    style H fill:#ff9800,color:#fff
    style K fill:#ff9800,color:#fff
    style O fill:#2196F3,color:#fff
```

---

## 5.4 Gestión del Catálogo de Tipos de Cultivo (CRUD Admin)

```mermaid
flowchart TD
    A([Admin accede a<br>Catálogo de Cultivos]) --> B{¿JWT válido y<br>rol = admin?}
    B -- No --> C[Responder 401/403]
    B -- Sí --> D{¿Operación?}

    D -- Listar --> E1[GET /api/v1/crop-types<br>?page=1&per_page=50]
    E1 --> F1[Query: tipos_cultivo<br>WHERE eliminado_en IS NULL]
    F1 --> G1[Responder 200 OK<br>lista paginada]

    D -- Crear --> E2[POST /api/v1/crop-types<br>nombre, descripcion]
    E2 --> F2{¿Ya existe un cultivo<br>con ese nombre?}
    F2 -- Sí --> G2[Responder 409 Conflict<br>Nombre duplicado]
    F2 -- No --> H2[INSERT tipos_cultivo]
    H2 --> I2[Responder 201 Created]

    D -- Actualizar --> E3[PUT /api/v1/crop-types/:id]
    E3 --> F3{¿Existe y no eliminado?}
    F3 -- No --> G3[Responder 404 Not Found]
    F3 -- Sí --> H3[UPDATE tipos_cultivo<br>actualizado_en = NOW]
    H3 --> I3[Responder 200 OK]

    D -- Eliminar --> E4[DELETE /api/v1/crop-types/:id]
    E4 --> F4{¿Hay áreas de riego<br>activas usando este cultivo?}
    F4 -- Sí --> G4[Responder 409 Conflict<br>No se puede eliminar:<br>hay áreas que lo usan]
    F4 -- No --> H4[Soft delete:<br>eliminado_en = NOW]
    H4 --> I4[Responder 200 OK]

    style A fill:#4CAF50,color:#fff
    style C fill:#f44336,color:#fff
    style G1 fill:#2196F3,color:#fff
    style G2 fill:#ff9800,color:#fff
    style I2 fill:#2196F3,color:#fff
    style G3 fill:#f44336,color:#fff
    style I3 fill:#2196F3,color:#fff
    style G4 fill:#ff9800,color:#fff
    style I4 fill:#2196F3,color:#fff
```
