# Tasks

- [ ] Serialize GET `/api/v1/readings` and GET `/api/v1/readings/latest` with nested `soil`, `irrigation`, and `environmental` objects (never JSON `null`) and all 12 v1 fields.
- [ ] Emit `timestamp` as UTC ISO 8601 ending in uppercase `Z`. Do not leak ORM/Spanish column names.
- [ ] Keep unavailable values as JSON `null`; keep measured `0`. Wrapper `id` / `node_id` may remain.
- [ ] Add focused tests for history and latest against `contracts/edge-cloud/v1/telemetry.schema.json` nested shape.
- [ ] Run the proposal verification commands. Stay in allowed paths. PR `Closes #N` when an issue exists.
