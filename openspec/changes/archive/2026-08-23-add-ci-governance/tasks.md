# Tasks

## 1. Config backend

- [ ] `[tool.ruff]` en `backend/pyproject.toml`: `line-length = 100`, `target-version = "py313"`, reglas por defecto (E4/E7/E9/F).
- [ ] `[tool.pytest.ini_options]` en `backend/pyproject.toml`: `testpaths = ["tests"]`.
- [ ] `uv run ruff check app tests` sin errores (arreglar hallazgos).

## 2. Workflow CI

- [ ] `.github/workflows/ci.yml`:
  - job `backend`: setup-uv, `uv sync --frozen`, `uv run ruff check app tests`, `uv run pytest -q`.
  - job `frontend`: setup-node 20 + cache npm, `npm ci`, `npm run typecheck`, `npm run test -- --run`, `npm run build`.

## 3. Verify

- [ ] Pipeline completo en verde en local (ruff, pytest, typecheck, vitest, build).
- [ ] Archivar cambio `add-ci-governance` (skip_specs).