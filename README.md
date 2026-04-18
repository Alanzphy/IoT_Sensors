# Sistema IoT de Riego Agrícola

Sistema web para el monitoreo de sensores de riego agrícola. Recibe lecturas de nodos IoT cada 10 minutos y las presenta en un dashboard multicategoría con históricos, filtros y exportación.

## Estructura del Proyecto

```
sensorestest/
├── AGENTS.md                # Contexto principal para agentes IA
├── README.md                # Este archivo
├── TEST_DATA.md             # Credenciales de prueba y API Keys
├── .gitignore
│
├── docs/                    # Documentación técnica del proyecto
│   ├── arquitectura.md          # Diagramas de arquitectura (MVP + Fase 2)
│   ├── design_system.md         # Paleta, tipografía, tokens del frontend
│   ├── documentacion_api.md     # Guía de la API REST
│   ├── documentacion_base_de_datos.md  # Modelo de datos explicado
│   └── srs/                     # Especificación de Requisitos
│
├── backend/                 # API REST (FastAPI + Python 3.11+)
│   ├── app/                     # Código fuente del servidor
│   ├── alembic/                 # Migraciones de base de datos MySQL
│   ├── Dockerfile               # Build optimizado para producción
│   └── pyproject.toml           # Dependencias (Gestionado con 'uv')
│
├── frontend/                # Web App (React + Vite)
│   ├── src/                     # Código fuente de UI
│   ├── Dockerfile               # Build multi-stage (Node -> Nginx)
│   └── nginx.conf               # Configuración SPA para servidor interno
│
├── simulator/               # Simulador de Hardware IoT
│   ├── simulator.py             # Script emisor de datos falsos en tiempo real
│   └── README.md
│
├── assets/                  # Recursos estáticos globales
│   └── imgs/                    # Logotipos
│
├── docker-compose.yml       # Orquestación de 3 contenedores (Dokploy/Traefik)
├── .env.docker.example      # Plantilla de variables de entorno (Producción)
└── openapi.yaml             # Spec OpenAPI 3.1 autogenerado
```

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11+ / FastAPI / Uvicorn |
| Frontend | React (SPA) |
| Base de Datos | MySQL 8 / SQLAlchemy / Alembic |
| Reverse Proxy | Traefik (vía Dokploy) / Nginx integrado en UI |
| Contenedores | Docker + Docker Compose |
| Servidor | VPS Linux ("Servidor Grogu") |

## Desarrollo Local

Para correr el sistema localmente para desarrollo o pruebas rápidas.

**Prerequisitos:** Tener [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.

---

**Paso 0 — Configurar variables de entorno del backend:**

> ⚠️ **Este paso es obligatorio.** Sin el `.env`, Alembic y FastAPI no pueden conectarse a la base de datos.

```bash
cd backend
cp .env.example .env
```

El archivo `.env` ya viene con los valores correctos para desarrollo local (la contraseña `rootpass` coincide con la que usa Docker).
Si cambiaste `DB_PASSWORD` en el `docker-compose.yml`, actualízala también en `.env`.

---

**Paso 1 — Levantar la Base de Datos:**
```bash
# Desde la raíz del proyecto
docker compose up -d mysql
```
Espera unos segundos a que MySQL termine de iniciar (puedes verificar con `docker ps`).

**Paso 2 — Backend (FastAPI):**
```bash
cd backend
uv sync                          # Instala dependencias del proyecto
uv run alembic upgrade head      # Crea las tablas en la BD
uv run python -m app.db.seed     # Inserta datos de prueba (usuarios, nodos, API Keys)
uv run uvicorn app.main:app --reload --port 5050
```
La API estará en `http://localhost:5050` (docs interactivos en `/docs`).

> El seed crea el admin, el cliente de prueba y los nodos con sus API Keys.
> Es seguro ejecutarlo varias veces — solo inserta lo que no existe.

**Paso 3 — Frontend (React/Vite):**
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```
La aplicación web estará en `http://localhost:5173`.

**Paso 4 — Simulador IoT:**
El simulador requiere una API Key de nodo. Las keys de prueba están en [`TEST_DATA.md`](TEST_DATA.md).
```bash
cd simulator
# El script usa librerías estándar, no requiere un venv

# Uso básico (una lectura cada 10 minutos, comportamiento real):
python3 simulator.py --api-key 99189486-8181-4e8c-8c6d-b3da66e6712b

# Para pruebas rápidas — enviar cada 30 segundos:
python3 simulator.py --api-key 99189486-8181-4e8c-8c6d-b3da66e6712b --interval 30

# Generar historial de los últimos 7 días de golpe:
python3 simulator.py --api-key 99189486-8181-4e8c-8c6d-b3da66e6712b --backfill 7
```
La key del ejemplo corresponde al **Nodo Nogal Norte**, vinculado al usuario `cliente@sensores.com`.

### Troubleshooting

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `Access denied for user 'root'` | Falta el `.env` o `DB_PASSWORD` está vacío | Ejecutar el **Paso 0** |
| `Can't connect to MySQL server` | El contenedor de MySQL no está listo | Esperar ~10s y reintentar, o `docker compose logs mysql` |
| `Connection refused` (localhost) | Problema de socket en Windows/WSL | Cambiar `DB_HOST=localhost` a `DB_HOST=127.0.0.1` en `.env` |

## Guía de Despliegue (Producción)

El proyecto está diseñado para desplegarse ágilmente en un VPS utilizando **Dokploy** y **Docker Compose**.

1. **Requisitos:** Un servidor VPS (ej. Ubuntu) con [Dokploy](https://dokploy.com) previamente instalado y tu dominio apuntando a la IP del servidor.
2. **Conectar Repositorio:** En el panel de Dokploy, crea un nuevo *Compose Project* y conéctalo a este repositorio Git.
3. **Variables de Entorno:** Copia el contenido del archivo `.env.docker.example`, pégalo en la pestaña "Environment" de Dokploy, y ajusta las claves (reemplaza `tudominio.com` y cambia las contraseñas).
4. **Desplegar:** Haz clic en "Deploy". Dokploy leerá el `docker-compose.yml`, construirá las imágenes optimizadas (multi-stage para React), levantará la base de datos MySQL, ejecutará las migraciones de Alembic y finalmente encenderá la API de FastAPI.
5. **SSL Automático:** Traefik detectará las etiquetas de enrutamiento y generará automáticamente los certificados SSL (Let's Encrypt), enrutando `/api/*` al backend y todo el resto al dashboard React.

### Scheduler De Inactividad (Producción)

El compose incluye el servicio `inactivity_scheduler`, que ejecuta de forma periódica el endpoint `POST /api/v1/alerts/scan-inactivity` para generar alertas por nodos inactivos.

Variables requeridas en producción:

- `SCHEDULER_ADMIN_EMAIL`
- `SCHEDULER_ADMIN_PASSWORD`
- `INACTIVITY_SCAN_INTERVAL_SECONDS` (recomendado: `300` = 5 min)
- `INACTIVITY_SCAN_MINUTES` (por defecto: `20`)

El scheduler se conecta internamente a `http://backend:5050/api/v1` y se inicia cuando el backend ya está saludable.

## Política de Documentación (Trabajo por Hitos)

Para evitar pérdida de contexto y desfase entre implementación y docs, este repositorio usa una estrategia híbrida:

1. **Actualización mínima inmediata:** cuando cambia contrato técnico (API, BD, flujo visible), se actualiza la documentación en el mismo bloque de trabajo.
2. **Cierre por hito/módulo:** al terminar un bloque funcional, se revisa consistencia cruzada entre arquitectura, API, BD y SRS.
3. **Pulido final de release:** al final del ciclo, se realiza limpieza editorial (formato, duplicados, pendientes).

Checklist mínimo por cambio técnico:

- ¿Cambió endpoint, parámetro o respuesta JSON? → actualizar `docs/documentacion_api.md`.
- ¿Cambió tabla, relación, índice o regla de negocio? → actualizar `docs/documentacion_base_de_datos.md`.
- ¿Cambió flujo operativo o componentes activos/futuros? → actualizar `docs/arquitectura.md` y/o `docs/arquitectura_frontend.md`.
- ¿Cambió alcance funcional del producto? → actualizar `docs/srs/`.

### Plantilla DoD Documental (Por Feature/Hito)

Usar esta plantilla al cerrar cada módulo para asegurar trazabilidad documental completa:

- Feature/Hito: `<nombre>`
- Fecha: `<YYYY-MM-DD>`
- Estado: `MVP` / `MVP Extendido (Fase 2 Lite)` / `Fase 2 Completa (futuro)`

Checklist DoD:

- [ ] API actualizada (`docs/documentacion_api.md`): endpoints, payloads, validaciones, errores, ejemplos.
- [ ] BD actualizada (`docs/documentacion_base_de_datos.md`): tablas, relaciones, índices, reglas de negocio.
- [ ] Arquitectura actualizada (`docs/arquitectura.md` y/o `docs/arquitectura_frontend.md`): flujo activo, componentes, límites de alcance.
- [ ] SRS actualizado (`docs/srs/`): requisitos activos vs roadmap, roles y restricciones.
- [ ] Consistencia transversal validada: misma terminología, mismos nombres de endpoint/campos, mismos estados de fase.

### Sincronizar OpenAPI (Contrato Runtime -> Archivos)

Cuando el backend ya está levantado, puedes regenerar ambos archivos de contrato (`openapi.yaml` y `docs/openapi.yaml`) desde el schema real expuesto por FastAPI:

```bash
./scripts/sync_openapi.sh
```

Atajo recomendado:

```bash
make openapi-sync
```

Notas:

- URL por defecto: `http://127.0.0.1:5050/api/v1/openapi.json`
- Puedes cambiarla temporalmente con `OPENAPI_URL`:

```bash
OPENAPI_URL="http://localhost:5050/api/v1/openapi.json" ./scripts/sync_openapi.sh
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [`TEST_DATA.md`](TEST_DATA.md) | **NUEVO:** Credenciales de prueba (admin/cliente) y API Keys |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Diagramas de infraestructura, flujos de datos, autenticación |
| [`docs/documentacion_api.md`](docs/documentacion_api.md) | Guía completa de la API REST |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Spec técnico OpenAPI 3.1 |
| [`docs/documentacion_base_de_datos.md`](docs/documentacion_base_de_datos.md) | Modelo de datos, tablas, relaciones |
| [`docs/design_system.md`](docs/design_system.md) | Design system del frontend |
| [`docs/srs/`](docs/srs/) | Especificación de Requisitos de Software |
