# Alerting and Notifications

## Purpose

Defines the alerting subsystem: configurable thresholds per irrigation area and parameter, automatic alert generation on threshold breach, inactivity detection, and external notifications (email/WhatsApp) per user preferences. This capability is **implemented but dormant** — active only when its feature flags are enabled.

## Requirements

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

### Requirement: Thresholds

- The system SHALL expose CRUD for thresholds (`/api/v1/thresholds`) per irrigation area and parameter, with severity levels `info`, `warning`, `critical`.
- Thresholds SHALL be scoped by ownership: admin manages all, client only their areas.
- Only one active threshold per area+parameter SHALL be allowed (no active duplicates).

#### Scenario: Client configures a humidity threshold
- **WHEN** a client creates a threshold for their area and parameter with a severity
- **THEN** the threshold is stored and applies to future readings of that area

### Requirement: Alert generation

- When enabled, ingesting a reading that breaches an active threshold SHALL generate an alert (type `threshold`) for the node/area/parameter.
- Alert deduplication SHALL use a configurable window (default 10 minutes) per area+node+parameter+severity.

#### Scenario: Repeated breach within window
- **WHEN** a parameter stays breached and more readings arrive within the dedup window
- **THEN** no duplicate alert is created until the window expires

### Requirement: Inactivity alerts

- When enabled, the inactivity scanner SHALL generate `critical` alerts (type `inactivity`) for nodes without a reading within the configured minutes (default 20).
- The scan SHALL run via `POST /api/v1/alerts/scan-inactivity`, invoked by the inactivity scheduler.

#### Scenario: Node inactive 20+ minutes
- **WHEN** the inactivity scan finds a node without readings for 20 minutes
- **THEN** a critical inactivity alert is created for that node

### Requirement: Alerts API

- The system SHALL expose listing/detail of alerts (`/api/v1/alerts`), unread count (`/api/v1/alerts/unread-count`), marking alerts as read (`PATCH /api/v1/alerts/{id}/read`), marking all as read (`POST /api/v1/alerts/read-all`), and dispatching pending notifications (`POST /api/v1/alerts/dispatch-notifications`).

#### Scenario: User marks alert as read
- **WHEN** a user marks an alert as read
- **THEN** the alert no longer counts toward the unread badge

#### Scenario: User marks all alerts as read
- **WHEN** a user marks all alerts as read
- **THEN** the unread count becomes zero for that user's scope

### Requirement: Notification preferences

- The system SHALL let clients configure notification preferences per area, alert type, severity, and channel (email/WhatsApp), plus a global enabled switch (`preferencias_notificacion`).
- The system SHALL evaluate dispatch for both channels according to preferences (type + severity + channel).

#### Scenario: Preference matches alert
- **WHEN** an alert matches a client's preference (type, severity, channel, enabled)
- **THEN** the dispatch engine sends it through the configured channel

### Requirement: Notification channels

- Email SHALL be sent via SMTP.
- WhatsApp SHALL support interchangeable providers (`meta` Cloud API or `twilio`), with text or template message modes.
- Dispatch SHALL happen through the notification scheduler (compose service) when enabled.

#### Scenario: Email notification sent
- **WHEN** dispatch runs for an alert with email preference enabled and SMTP configured
- **THEN** an email is sent via SMTP with the alert details

### Requirement: AI alert recommendations

- The system SHALL expose `POST /api/v1/alerts/{alert_id}/recommendation` to generate an agronomic recommendation for an alert (admin and client scoped).
- The recommendation SHALL record its source (`ai` via Azure or `fallback` deterministic) and cached content fields on the alert, and the generation SHALL be audited.

#### Scenario: Client requests recommendation for an alert
- **WHEN** a client opens an alert detail and requests the recommendation
- **THEN** a recommendation is generated (Azure or deterministic fallback) and stored on the alert with its source

### Requirement: Audit logging

- The system SHALL record in `audit_log` the mutations of thresholds, alerts (AI recommendation), notification preferences, AI usage, and password recovery (user, entity, timestamp).
- The system SHALL expose `GET /api/v1/audit-logs` (admin) consumed by the admin audit view (`/admin/auditoria`).
- CRUD mutations of base entities (clients, properties, areas, nodes, crop types, cycles) are NOT currently audited.

#### Scenario: Threshold change audited
- **WHEN** an admin creates or edits a threshold
- **THEN** the action is recorded in audit_log with user, entity, and timestamp

#### Scenario: Admin inspects audit log
- **WHEN** an admin opens the audit view
- **THEN** the audit entries are listed with user, entity, and timestamp
