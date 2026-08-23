## MODIFIED Requirements

### Requirement: Feature flags and runtime gates

- Threshold alert generation SHALL be gated by `ALERTS_ENABLED` (default `false`): reading ingestion SHALL NOT generate threshold alerts while the flag is off.
- External dispatch SHALL be gated: `NOTIFICATIONS_ENABLED` (default false), `NOTIFICATIONS_EMAIL_ENABLED`, `NOTIFICATIONS_WHATSAPP_ENABLED`.
- The 3 schedulers SHALL be compose services behind the `phase2` profile and SHALL NOT start with a plain `docker compose up`.
- With all flags off, the platform SHALL operate as a Fase 1 MVP (ingest, query, visualization, freshness); thresholds CRUD and alert queries remain available but inert.

#### Scenario: Alerts disabled

- **WHEN** the platform runs with `ALERTS_ENABLED=false`
- **THEN** reading ingestion stores readings without creating threshold alerts, no scheduler containers run, and no external dispatch occurs

#### Scenario: Alerts enabled

- **WHEN** `ALERTS_ENABLED=true` and a reading breaches an active threshold
- **THEN** a threshold alert is created (dedup window applies)