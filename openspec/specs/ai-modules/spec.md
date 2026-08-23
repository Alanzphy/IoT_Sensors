# AI Modules

## Purpose

Defines the AI-powered capabilities: the conversational assistant, asynchronous reports, and usage observability. Implemented with Azure OpenAI plus a deterministic rule-based fallback. **Dormant by default** — endpoints respond 503 and schedulers are off unless their feature flags are enabled.

## Requirements

### Requirement: Feature flags (current defaults)

- The conversational assistant SHALL be dormant by default: `AI_ASSISTANT_ENABLED` SHALL default to `false` in code and compose; while disabled, `POST /api/v1/ai-assistant/chat` responds 503.
- Asynchronous reports SHALL remain dormant by default (`AI_REPORTS_ENABLED` defaults `false`; `POST /api/v1/ai-reports/generate` responds 503 while disabled).
- The AI report scheduler SHALL run as a compose service behind the `phase2` profile, gated additionally by `AI_REPORTS_SCHEDULER_ENABLED` (default false).

#### Scenario: AI disabled

- **WHEN** `AI_ASSISTANT_ENABLED=false` or `AI_REPORTS_ENABLED=false`
- **THEN** the corresponding endpoints respond 503 and the AI report scheduler does not run

#### Scenario: Assistant enabled without Azure

- **WHEN** `AI_ASSISTANT_ENABLED=true` with `AZURE_OPENAI_ENABLED=false`
- **THEN** the assistant responds using the deterministic fallback

### Requirement: Conversational assistant

- The system SHALL expose `POST /api/v1/ai-assistant/chat` authenticated by user role, with ownership scoping (client → own areas; admin → all).
- The response SHALL include natural-language text plus optional dynamic widgets (`kpi_cards`, `table`, `line_chart`).
- Guardrails: per-user rate limiting (configurable window/requests) and backend context limits (`AI_ASSISTANT_MAX_AREAS`, `MAX_ALERTS`, `MAX_HISTORY_MESSAGES`).

#### Scenario: Client asks about their areas
- **WHEN** a client asks the assistant a question about their irrigation areas
- **THEN** the assistant answers with real context scoped to that client's areas and returns widgets when relevant

### Requirement: Azure OpenAI with deterministic fallback

- When `AZURE_OPENAI_ENABLED=true` and credentials are configured, the modules SHALL use Azure OpenAI.
- When Azure is unavailable or disabled, the system SHALL produce a deterministic rule-based fallback (summaries, findings, recommendations) so the operational flow keeps working locally and in production.

#### Scenario: Azure unavailable
- **WHEN** Azure OpenAI is disabled or errors
- **THEN** the assistant/report still returns a useful deterministic response

### Requirement: Asynchronous reports

- The system SHALL expose `GET /api/v1/ai-reports`, `GET /api/v1/ai-reports/{id}`, and `POST /api/v1/ai-reports/generate` (admin/scheduler only).
- Reports SHALL be persisted in `reportes_ia` with status enum (`pending/processing/completed/failed`), range, summary, findings, recommendation, generation metadata, and error detail.
- The daily report scheduler SHALL run at a configurable UTC hour (default 02:00) without n8n (backend-internal scheduler).

#### Scenario: Scheduler generates a report
- **WHEN** the AI report scheduler runs for a client/area range
- **THEN** a report is persisted with status completed and its content generated (Azure or fallback)

### Requirement: Usage observability

- The system SHALL record per-request usage metadata: source, provider, model, prompt/completion tokens, latency, and status code.
- Admins SHALL query usage via `GET /api/v1/ai-assistant/usage` and view it in the admin UI (`/admin/consumo-ia`).

#### Scenario: Admin inspects usage
- **WHEN** an admin opens the AI usage page
- **THEN** per-request metadata (provider, model, tokens, latency, status) is listed

### Requirement: Architecture decisions (in force)

- Orchestration SHALL live in the backend (FastAPI + internal schedulers); n8n is out of scope by product decision.
- Azure OpenAI SHALL NOT access MySQL directly: the backend prepares the context and calls the model.

#### Scenario: Backend orchestrates without n8n
- **WHEN** a scheduled AI job must run
- **THEN** a backend-internal scheduler triggers the API, never an external n8n workflow
