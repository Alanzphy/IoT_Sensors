# Tasks

## 1. Add ALERTS_ENABLED flag and flip AI_ASSISTANT_ENABLED default

- [ ] `backend/app/core/config.py`: add `ALERTS_ENABLED: bool = False`; change `AI_ASSISTANT_ENABLED: bool = True` → `False`.

## 2. Gate threshold alert generation on ingest

- [ ] `backend/app/services/reading.py`: wrap `_create_threshold_alerts` call in `if settings.ALERTS_ENABLED:`.

## 3. Compose: flags off by default and phase2 profile

- [ ] `docker-compose.yml`: add `ALERTS_ENABLED=${ALERTS_ENABLED:-false}` to backend env.
- [ ] `docker-compose.yml`: flip `AI_ASSISTANT_ENABLED=${AI_ASSISTANT_ENABLED:-true}` → `:-false`.
- [ ] `docker-compose.yml`: add `profiles: ["phase2"]` to the 3 schedulers.

## 4. Env examples

- [ ] `.env.docker.example`: set Fase 2 flags `false` by default with enablement comments.
- [ ] `backend/.env.example`: same.

## 5. Tests

- [ ] `backend/tests/conftest.py`: set `ALERTS_ENABLED=true` and `AI_ASSISTANT_ENABLED=true` env defaults before app import.
- [ ] Add test: ingest with `ALERTS_ENABLED=false` does not create threshold alerts.
- [ ] Add test: AI assistant chat returns 503 with `AI_ASSISTANT_ENABLED=false`.

## 6. Docs

- [ ] `README.md`: schedulers behind `--profile phase2`; demo checklist includes `ALERTS_ENABLED=true`; assistant default off.
- [ ] `AGENTS.md`: §1 note Fase 2 implemented but dormant behind flags (OFF by default).

## 7. Verify

- [ ] `cd backend && uv run pytest -q` green.
- [ ] `openspec validate` green; archive change to sync specs.