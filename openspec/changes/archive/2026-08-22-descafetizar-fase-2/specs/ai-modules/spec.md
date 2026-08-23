## MODIFIED Requirements

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