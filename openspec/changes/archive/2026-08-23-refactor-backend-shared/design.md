# Design: Refactor backend shared

## Shared modules (nuevos, en `app/core/`)

| Módulo | Contenido | Consumidores actuales del duplicado |
|---|---|---|
| `authz.py` | Resolución de `allowed_area_ids` para cliente/admin (y helpers de scope por rol) | `endpoints/readings.py`, `alerts.py`, `thresholds.py`, `nodes.py`, `crop_cycles.py` |
| `time.py` | `utc_now()` (datetime naive UTC) | servicios varios (≥10 sitios) |
| `emailer.py` | Envío SMTP con `MIMEText` + settings | `alert.py`, `ai_report.py`, `password_reset.py` |
| `scheduler_client.py` | `SchedulerApiClient` (login JWT admin, refresh, POST con timeout y retry simple) | `jobs/inactivity_scheduler.py`, `jobs/notification_scheduler.py`, `jobs/ai_report_scheduler.py` |

Reglas: sin cambio de comportamiento; los tests existentes de jobs/servicios verifican. Los endpoints reemplazan `_require_admin` local por `deps.require_admin` cuando el duplicado es idéntico.

## Split de god services

- `services/alert.py` → paquete `services/alerts/` con: `thresholds.py`, `inactivity.py`, `dispatch.py`, `recommendations.py`, `queries.py` (y `__init__.py` re-exportando la API pública para que `from app.services import alert as alert_service` siga funcionando).
- `services/ai_chat.py` → `services/ai_chat/` (o módulos `ai_chat_*.py`): contexto de datos, orquestación del modelo, fallback determinístico, logging de uso.
- Se preservan firmas públicas y nombres internos importados por endpoints/tests.

## Dead code

- `models/reading.py`: propiedades `soil`/`irrigation`/`environmental` self-returning → eliminar.
- `pyproject.toml`: quitar `passlib[bcrypt]` (se usa `bcrypt` directo); regenerar `uv.lock` con `uv lock`.

## Verification

- `uv run pytest -q` (327+ tests) en verde.
- `uv run python -c "from app.main import app"` importa sin errores.
- `uv run ruff check app` (si ruff disponible; si no, omitir).