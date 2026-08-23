# Tasks

## 1. Módulos compartidos en `app/core/`

- [ ] `authz.py`: scope de `allowed_area_ids` por rol (cliente → sus áreas; admin → todas).
- [ ] `time.py`: `utc_now()` y reemplazo de los ≥10 `datetime.now(UTC).replace(tzinfo=None)` / `utc_now_naive`.
- [ ] `emailer.py`: `send_email(...)` SMTP (MIMEText, settings), usado por alert, ai_report, password_reset.
- [ ] `scheduler_client.py`: `SchedulerApiClient` único (login/refresh/HTTP), usado por los 3 jobs.

## 2. Dedup en endpoints

- [ ] Reemplazar `_get_client_area_ids`/variantes en readings, alerts, thresholds, nodes, crop_cycles por el helper compartido.
- [ ] Reemplazar `_require_admin` local por `deps.require_admin` donde el duplicado sea idéntico.

## 3. Split de god services

- [ ] `alert.py` → paquete `services/alerts/` por responsabilidad, con re-export compatible.
- [ ] `ai_chat.py` → módulos por responsabilidad (contexto, orquestación, fallback, usage).
- [ ] Verificar imports de endpoints/tests intactos.

## 4. Dead code

- [ ] Eliminar propiedades self-returning de `models/reading.py`.
- [ ] Quitar `passlib[bcrypt]` de `pyproject.toml` + `uv lock` regenerado.

## 5. Verify

- [ ] `uv run pytest -q` verde.
- [ ] `uv run python -c "from app.main import app"` sin errores.
- [ ] Archivar cambio con `--skip-specs` (refactor puro, sin delta de spec).