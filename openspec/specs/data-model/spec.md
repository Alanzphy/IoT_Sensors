# Data Model

## Purpose

Defines the relational data model of the IoT irrigation monitoring platform: the client → property → irrigation area hierarchy, the sensor readings wide-table, and the supporting catalogs. This spec is the baseline of the current implemented state (Fase 1 MVP + Fase 2 tables already migrated).

## Requirements

### Requirement: Entity hierarchy

- The system SHALL organize data under the hierarchy Client → Property (`predios`) → Irrigation Area (`areas_riego`).
- A Client SHALL own one or more Properties; a Property SHALL contain one or more Irrigation Areas.
- An Irrigation Area SHALL have exactly one Crop Type (from the admin-manageable catalog) and exactly one IoT Node (1:1 relationship, enforced by a unique constraint on `nodos.area_riego_id`).
- A Client SHALL NOT access data of other clients (ownership enforced in the service layer by client-scoped queries).

#### Scenario: Admin creates a node for an area
- **WHEN** an admin registers an IoT node for an irrigation area
- **THEN** the node is linked 1:1 to that area and assigned a fixed API key

### Requirement: Sensor readings (wide table)

- The system SHALL store each reading as a single row in the `lecturas` table with all 12 dynamic fields flattened (soil, irrigation, environmental categories).
- Each reading SHALL store a mandatory `marca_tiempo` (UTC) to enable date-range queries.
- Readings SHALL NOT include static data (crop type, area size, GPS) — those are stored once on the node/area.
- The table SHALL be indexed for `(nodo_id, marca_tiempo)` and `marca_tiempo` to support 144 readings/day per node.

#### Scenario: Reading with unavailable fields
- **WHEN** a node sends a reading with a dynamic field unavailable (0 or null)
- **THEN** the corresponding column stores the null value and the reading remains valid

#### Scenario: Reading without static data
- **WHEN** a reading is stored
- **THEN** it contains only the 12 dynamic fields and the timestamp, never crop type, area size, or GPS

#### Scenario: Query by date range
- **WHEN** a user queries readings for an area between two dates
- **THEN** the index on (nodo_id, marca_tiempo) serves the range efficiently

### Requirement: Crop types catalog

- The system SHALL maintain an admin-manageable catalog of crop types (`tipos_cultivo`).
- The seed SHALL include: Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón.
- Admins SHALL be able to create, edit, and delete crop types.

#### Scenario: Admin deletes an unused crop type
- **WHEN** an admin deletes a crop type that no irrigation area uses
- **THEN** the crop type is removed (soft delete) from the catalog

### Requirement: Crop cycles

- The system SHALL support multiple crop cycles (`ciclos_cultivo`) per irrigation area (season history: 2025, 2026...).
- Only one cycle SHALL be active at a time per area (the one without `fecha_fin` or with future `fecha_fin`).

#### Scenario: New season starts
- **WHEN** an admin opens a new crop cycle for an area that has a finished cycle
- **THEN** the new cycle becomes the active one and the previous one keeps its end date in history

### Requirement: Timestamps and soft delete

- The system SHALL store timestamps in UTC (naive DATETIME, ISO 8601 on the API).
- Main entities SHALL implement soft delete via an `eliminado_en` column (TimestampMixin/SoftDeleteMixin), and default queries SHALL filter `eliminado_en IS NULL`.

#### Scenario: Soft-deleted entity disappears from listings
- **WHEN** an admin deletes an entity (soft delete)
- **THEN** the row keeps `eliminado_en` set and standard listings no longer include it

### Requirement: Fase 2 tables (implemented)

- The database SHALL include the Fase 2 tables: `umbrales`, `alertas`, `preferencias_notificacion`, `tokens_recuperacion`, `audit_log`, `reportes_ia`.
- These tables exist and are migrated. With notification/AI flags off, no external dispatch or AI reports are produced; threshold alerts continue to be written during ingestion (see alerting capability).

#### Scenario: Dormant tables with notification/AI features off
- **WHEN** the platform runs with notification and AI flags disabled
- **THEN** the Fase 2 tables exist in the schema but no notification dispatch or AI report is written; threshold alerts may still be generated on ingest