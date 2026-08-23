# Design: Estabilizar plataforma

## Backend

1. **Ownership crop-cycles** (`endpoints/crop_cycles.py`): cuando el cliente omite `irrigation_area_id`, filtrar por sus `area_riego_id` (misma técnica de authz que `readings`).
2. **API key oculta** (`schemas/node.py`): quitar `api_key` de `NodeResponse` (listado/detalle); mantenerla solo en el schema de creación. Verificar que el frontend no dependa de `api_key` en GET.
3. **Revocación refresh** (`services/user.py` `update_user`): si cambia `contrasena`, revocar los refresh tokens del usuario (reutilizar lógica de `password_reset`).
4. **CORS** (`main.py` + `config.py`): `CORS_ORIGINS: str = ""` (coma-separada); `allow_origins` = lista parseada o `["*"]`; `allow_credentials` solo si no es `*`.
5. **Guard SECRET_KEY** (`config.py`): `model_validator(after)` — si `not DEBUG` y `SECRET_KEY` es uno de los defaults conocidos → `ValueError`. Tests: conftest setea `SECRET_KEY` y `DEBUG=true`.
6. **Rate-limit login** (`endpoints/auth.py` + `config.py`): ventana y máximo configurables; store en memoria por email e IP; 429 al exceder.
7. **`/users/me`** (`endpoints/users.py` + `services/user.py` + `schemas/user.py`): GET y PATCH del usuario autenticado (email read-only).
8. **`.coverage`**: `git rm --cached` + entrada en `.gitignore`.

## Frontend

1. **`tsconfig.json`** standalone: `include: ["src"]`, `types: ["vite/client"]`, `jsx: react-jsx`, `moduleResolution: bundler`, `skipLibCheck: true`, `strict: false`, `noEmit: true` (el endurecimiento estricto es otro cambio).
2. **`src/types/api.ts`**: tipos de lectura (`ReadingResponse` con `soil`/`irrigation`/`environmental` anidados), reflejando `schemas/reading.py` del backend.
3. **Interceptor 401 + refresh** (`services/api.ts` + `AuthContext.tsx`): condición corregida (excluir rutas públicas); en 401, un reintento con `POST /auth/refresh` (contrato: `{access_token}`), y logout solo si el refresh falla.
4. **Limpieza**: quitar `/admin/consume-ia` (typo); `CropCycleManagement` `area.nombre` → `area.name`; `PropertyDetail` `area.area_size` y `/readings` sin trailing slash; quitar el SVG de mapa falso.
5. **Pollings**: `ClientDashboard`, `AlertsCenterPage`, `AlertsPopover` de 3s → 30s.
6. **ProfilePage**: datos reales desde `/users/me` (nombre editable, email read-only, guardado con PATCH).

## Trade-offs

- Rate-limit en memoria: suficiente para un solo worker uvicorn; no escala a multi-worker (se documenta).
- `strict: false` mantiene el estado actual de tipos; el plan de tipos estrictos es un cambio aparte.
- Los endpoints de `users` existentes (admin CRUD) no cambian; `/users/me` es aditivo.

## Files

Ver listado en `tasks.md`.