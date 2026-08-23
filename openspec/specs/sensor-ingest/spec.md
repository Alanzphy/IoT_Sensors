# Sensor Ingest

## Purpose

Defines how IoT nodes (and the hardware simulator) send sensor readings to the platform: a write-only public endpoint authenticated with a fixed per-node API key, storing the unified JSON payload with the 3 dynamic categories.

## Requirements

### Requirement: Reading ingestion endpoint

- The system SHALL expose `POST /api/v1/readings` for sensor payload ingestion.
- The endpoint SHALL authenticate the node via the `X-API-Key` header, validated against the `nodos` table.
- The payload SHALL contain a mandatory `timestamp` (ISO 8601 UTC) and the 3 dynamic categories: `soil` (4 fields), `irrigation` (3 fields), `environmental` (5 fields).
- The endpoint SHALL reject payloads with an invalid or unknown API key (401/403).
- The endpoint SHALL return the created reading id, node id, and timestamps (201).
- The endpoint SHALL be write-only: it must not expose reading queries.

#### Scenario: Node sends a valid reading
- **WHEN** a node POSTs a payload with a valid `X-API-Key`, timestamp and the 3 categories
- **THEN** the reading is stored in a single row and the API returns 201 with the reading metadata

#### Scenario: Invalid API key
- **WHEN** a request POSTs to /api/v1/readings with an unknown or missing API key
- **THEN** the API rejects the request with 401/403 and no reading is stored

### Requirement: Payload semantics

- The system SHALL store unavailable dynamic fields as-is: `null` values are stored as NULL and `0` values are stored as `0` (no normalization).
- `irrigation.active` SHALL be a boolean; `accumulated_liters` and `flow_per_minute` SHALL be separate numeric fields.
- Static data (crop type, area size, GPS) SHALL NOT be part of the payload; unknown extra fields are ignored.
- NDVI SHALL NOT be part of the payload (excluded from MVP).

#### Scenario: Node without a sensor category value
- **WHEN** a node lacks a specific sensor (e.g., no ETO sensor)
- **THEN** the payload sends that field as `0` or `null` and the reading is stored correctly (null → NULL, 0 → 0)

### Requirement: Ingest cadence

- The system SHALL accept readings at any cadence; the designed target is 1 reading every 10 minutes per node (144 per day).
- Ingestion SHALL NOT depend on the simulator; any HTTP client with a valid node API key can send readings.
- The backend SHALL accept ISO 8601 timestamps; values without a `Z`/offset (naive) are stored as provided without UTC normalization, and duplicate timestamps for the same node are not deduplicated.

#### Scenario: Simulator sends readings on schedule
- **WHEN** the hardware simulator POSTs every 10 minutes with a valid node key
- **THEN** the platform stores 144 readings per day per node without errors

#### Scenario: Naive timestamp received
- **WHEN** a node sends a timestamp without timezone marker
- **THEN** the reading is stored with the timestamp as provided (no UTC conversion)