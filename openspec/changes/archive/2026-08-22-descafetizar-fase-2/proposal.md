# Proposal: Descafetizar Fase 2 (dormant by default)

## Problem

Fase 2 capabilities (threshold alerts, inactivity scanning, notification dispatch, AI assistant/reports) are implemented but **not gated by default**:

- Threshold alerts are generated on **every reading ingest** with no flag (`services/reading.py:167`).
- `AI_ASSISTANT_ENABLED` defaults to `true` (`config.py:90`, `docker-compose.yml:97`), so the AI assistant is active without Azure credentials (rule-based fallback) — contradicting the MVP contract in AGENTS.md.
- The 3 schedulers (`inactivity_scheduler`, `notification_scheduler`, `ai_report_scheduler`) are default compose services that crash-loop when `SCHEDULER_ADMIN_EMAIL/PASSWORD` are missing.
- Production `.env.docker.example` enables notifications and AI reports by default.

## Goals

- Fase 2 stays implemented and tested, but **dormant by default**: the platform behaves as a Fase 1 MVP unless explicitly enabled.
- Introduce `ALERTS_ENABLED` (default `false`) gating threshold-alert generation on ingest.
- `AI_ASSISTANT_ENABLED` default flips to `false` (endpoint already returns 503 when disabled).
- Schedulers move behind a `phase2` compose profile; `docker compose up` no longer starts them.
- Env examples and README document how to enable each Fase 2 module.

## Non-goals

- No deletion of Fase 2 code or endpoints (they remain fully available behind flags).
- No changes to thresholds CRUD, alerts query UI, or notification preferences UI (inert without generation/dispatch).
- No refactor of god services (separate change).

## How

1. `config.py`: add `ALERTS_ENABLED: bool = False`; flip `AI_ASSISTANT_ENABLED` default to `False`.
2. `reading.py`: gate `_create_threshold_alerts` on `settings.ALERTS_ENABLED`.
3. `docker-compose.yml`: add `ALERTS_ENABLED` env to backend (default false); flip `AI_ASSISTANT_ENABLED` default to false; add `profiles: ["phase2"]` to the 3 schedulers.
4. `.env.docker.example` / `backend/.env.example`: set all Fase 2 flags to `false` with documented sections.
5. Tests: suite runs with flags enabled via conftest env defaults; add tests for disabled behavior (ingest without alerts, AI chat 503).
6. README/AGENTS.md: document dormant-by-default contract and how to enable Fase 2 (env + `--profile phase2`).

## Impact

- Backend: `core/config.py`, `services/reading.py`, `docker-compose.yml`, env examples, tests.
- Docs: README, AGENTS.md.
- Specs: `alerting`, `ai-modules` (delta).