# Design: Descafetizar Fase 2

## Approach

Centralize the dormancy contract in `Settings` and gate behavior at the single decision points already present:

1. **`config.py`** — add `ALERTS_ENABLED: bool = False`; flip `AI_ASSISTANT_ENABLED` default to `False`. Both already read as env vars (pydantic-settings, case-sensitive), so compose/env examples control them.
2. **`reading.py`** — wrap `_create_threshold_alerts(db, node, reading)` in `if settings.ALERTS_ENABLED:`. Ingest stays unchanged otherwise (no behavior change when enabled).
3. **`docker-compose.yml`** — add `ALERTS_ENABLED=${ALERTS_ENABLED:-false}` to backend env; flip `AI_ASSISTANT_ENABLED` default to `false`; add `profiles: ["phase2"]` to `inactivity_scheduler`, `notification_scheduler`, `ai_report_scheduler`. Schedulers keep their flag checks (`AI_REPORTS_SCHEDULER_ENABLED`) and credential requirements.
4. **Env examples** — `.env.docker.example` and `backend/.env.example`: all Fase 2 flags `false` by default, grouped and commented for how to enable each module.
5. **Tests** — `conftest.py` sets `ALERTS_ENABLED=true` and `AI_ASSISTANT_ENABLED=true` via env defaults before app import so the existing suite keeps its behavior. Add two disabled-behavior tests:
   - ingest with `ALERTS_ENABLED=false` creates no threshold alert (monkeypatch).
   - `POST /ai-assistant/chat` returns 503 with `AI_ASSISTANT_ENABLED=false` (monkeypatch).
6. **Docs** — README: scheduler sections note `--profile phase2`; demo checklist adds `ALERTS_ENABLED=true`; AGENTS.md §1 notes Fase 2 is implemented but dormant behind flags.

## Trade-offs

- Thresholds/alerts CRUD endpoints stay available when `ALERTS_ENABLED=false` (inert): they are configuration UI, and gating them would break the frontend pages. Dormancy targets *automatic* behavior (generation, schedulers, dispatch).
- `phase2` profile means Dokploy must add `--profile phase2` (or the compose command must include it) to run schedulers; documented in README.
- The `scan-inactivity` endpoint remains admin-callable; its scheduler is what's gated. Manual invocation is an explicit admin action, not automatic behavior.

## Files

- `backend/app/core/config.py`
- `backend/app/services/reading.py`
- `docker-compose.yml`
- `.env.docker.example`, `backend/.env.example`
- `backend/tests/conftest.py`, `backend/tests/integration/test_thresholds_alerts_api.py`, `backend/tests/integration/test_ai_assistant_api.py`
- `README.md`, `AGENTS.md`