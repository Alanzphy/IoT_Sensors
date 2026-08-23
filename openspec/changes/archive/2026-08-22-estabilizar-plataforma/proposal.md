# Proposal: Estabilizar plataforma (build frontend + seguridad + ownership)

## Problem

La auditoría código-vs-spec detectó defectos que bloquean o comprometen la operación:

- **Build frontend roto**: `HistoricalData.tsx` importa `../../types/api` que no existe; no hay `tsconfig.json` (el typecheck no puede correr).
- **Sesiones rotas**: el interceptor 401 de axios tiene la condición invertida (`!pathname.startsWith("/")` es siempre false) y el refresh token se guarda pero nunca se usa → la sesión muere al expirar el access token.
- **Fuga de datos**: `GET /crop-cycles` sin filtro expone ciclos de todos los clientes; `GET /nodes` y `/nodes/geo` exponen la `api_key` de los nodos a clientes.
- **Seguridad**: CORS `*` + `allow_credentials=True` (inválido en browsers); `SECRET_KEY` default débil sin guard de arranque; login sin rate-limit; admin no revoca refresh tokens al cambiar contraseña.
- **Deuda de UI**: ruta duplicada `/admin/consume-ia` (typo), `CropCycleManagement` usa `area.nombre` (undefined), `PropertyDetail` usa `area.size` y trailing slash en `/readings/`, pollings de prueba a 3s, `ProfilePage` 100% estático sin API.
- `.coverage` commiteado y stale.

## Goals

- `npm run typecheck` y `npm run build` en verde.
- Sesión robusta: interceptor 401 corregido y refresh automático del access token.
- Ownership estricto: ciclos de cultivo scopeados al cliente; `api_key` fuera de las respuestas de nodos.
- Hardening: guard de `SECRET_KEY` en producción, CORS configurable por env (sin credenciales con `*`), rate-limit de login, revocación de refresh en cambio de contraseña.
- `ProfilePage` conectado a un endpoint real `GET/PATCH /users/me`; `PropertyDetail` sin mapa falso.
- Pollings restaurados a 30s.

## Non-goals

- No refactor de god services (separate change).
- No typecheck estricto (se mantiene `strict: false`; el endurecimiento de tipos es otro cambio).
- No rate-limit distribuido (en memoria, suficiente para MVP).

## How

Dos frentes paralelos:
1. **Backend** (`backend/app/`): ownership crop-cycles, api_key oculta, revocación refresh en `update_user`, CORS por env, guard SECRET_KEY, rate-limit login, endpoints `/users/me`, `.coverage` fuera del repo.
2. **Frontend** (`frontend/`): `tsconfig.json`, `src/types/api.ts`, interceptor 401 + refresh flow, limpieza de ruta/campos duplicados, pollings 30s, `ProfilePage`/`PropertyDetail` contra API real.

Verificación: pytest verde + `npm run typecheck` + `npm run build`.

## Impact

- Backend: `core/config.py`, `core/security.py` (si aplica), `api/v1/endpoints/{auth,crop_cycles,nodes,users}.py`, `services/{user,node,crop_cycle}.py`, `schemas/{node,user}.py`, `main.py`, tests, `.gitignore`.
- Frontend: `tsconfig.json`, `src/types/api.ts`, `src/app/services/api.ts`, `src/app/context/AuthContext.tsx`, `src/app/routes.tsx`, páginas `ProfilePage`/`PropertyDetail`/`CropCycleManagement`/`ClientDashboard`/`AlertsCenterPage`/`AlertsPopover`.
- Specs: `user-auth`, `data-model` (delta).