# Tasks

## Backend

- [ ] `endpoints/crop_cycles.py`: scope de ownership para clientes cuando no hay `irrigation_area_id`.
- [ ] `schemas/node.py`: quitar `api_key` de las respuestas (mantener en creación); verificar frontend.
- [ ] `services/user.py`: revocar refresh tokens en `update_user` si cambia la contraseña.
- [ ] `core/config.py`: `CORS_ORIGINS`, `LOGIN_RATE_LIMIT_*`, guard de `SECRET_KEY` con `model_validator`.
- [ ] `main.py`: CORS con credenciales solo si origins explícitas.
- [ ] `endpoints/auth.py`: rate-limit de login (429).
- [ ] `endpoints/users.py` + `services/user.py` + `schemas/user.py`: `GET/PATCH /users/me`.
- [ ] `.gitignore` + `git rm --cached backend/.coverage`.
- [ ] Tests: coverage de los nuevos comportamientos (crop-cycles scope, api_key oculta, refresh revoke, rate-limit, users/me, SECRET_KEY guard).
- [ ] `uv run pytest -q` verde.

## Frontend

- [ ] `tsconfig.json` standalone (typecheck funcional).
- [ ] `src/types/api.ts` con `ReadingResponse` y tipos usados.
- [ ] `services/api.ts`: interceptor 401 corregido + refresh automático con `/auth/refresh`.
- [ ] `AuthContext.tsx`: integrar refresh/logout coherente.
- [ ] `routes.tsx`: eliminar `/admin/consume-ia` duplicada.
- [ ] `CropCycleManagement.tsx`: `area.nombre` → `area.name`.
- [ ] `PropertyDetail.tsx`: `area.area_size`, `/readings` sin trailing slash, quitar mapa SVG falso.
- [ ] `ProfilePage.tsx`: conectar a `/users/me`.
- [ ] Pollings 3s → 30s: `ClientDashboard`, `AlertsCenterPage`, `AlertsPopover`.
- [ ] `npm run typecheck` y `npm run build` en verde.

## Verify

- [ ] `openspec validate --changes` y `--specs` verdes.
- [ ] Archivar el cambio y commitear.