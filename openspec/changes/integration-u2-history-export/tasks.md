# Tasks

- [ ] Confirm U1 is merged on `main`. Stop if it is not.
- [ ] In `HistoricalData.tsx` and `ReadingDateRangeSelector.tsx`, resolve week/month/year/custom ranges to exact `start_date`/`end_date`. Keep cycle filter, pagination, and area scope.
- [ ] In `ExportData.tsx`, trigger CSV/XLSX/PDF via the existing export endpoint and query. Do not generate files in the backend. Surface failures.
- [ ] Preserve units and `null` semantics; cover loading, empty, error, and page/range changes. Run the proposal verification commands. PR `Closes #N` when an issue exists.
