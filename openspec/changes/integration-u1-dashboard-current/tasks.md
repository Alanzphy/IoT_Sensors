# Tasks

- [ ] Render current nested telemetry from existing readings OpenAPI. Keep units. Distinguish JSON `null` from measured `0`. Emphasize soil humidity, flow, and ETO. Tolerate current nullable OpenAPI categories until C1 merges.
- [ ] Show freshness using existing `FRESH_MINUTES_THRESHOLD` mapped to current/stale; do not invent a vocabulary that fights `helpers.ts`. Cover loading, empty, and error.
- [ ] Show weather and latest-point NDVI cards from `docs/integration/frontend-evidence/` 200 fixtures, visually separate from telemetry. NDVI is not a 13th field. Errors use existing UI error state; no extra fixtures required.
- [ ] Add focused component tests. Run the proposal verification commands. Stay frontend-only. PR `Closes #N` when an issue exists.
