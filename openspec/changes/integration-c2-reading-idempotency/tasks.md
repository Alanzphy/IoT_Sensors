# Tasks

- [ ] Confirm C1 is merged on `main`. Stop if it is not.
- [ ] Persist `X-Event-ID` on telemetry ingest, scoped to authenticated node + `POST /api/v1/readings`.
- [ ] Add an Alembic migration. First valid event: `201` and one row. Exact retry (same node, endpoint, ID, body): `200` and still one row.
- [ ] Same ID with a different body: `409` and no mutation. Missing/invalid API key or event ID: fail with no mutation.
- [ ] Add focused retry/conflict/concurrency tests. Run the proposal verification commands. PR `Closes #N` when an issue exists.
