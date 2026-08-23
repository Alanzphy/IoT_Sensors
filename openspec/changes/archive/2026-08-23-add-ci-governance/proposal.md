# Proposal: Add CI governance (lint + tests + build)

## Problem

El repo no tiene CI: los 327 tests del backend, el typecheck/build del frontend y el lint solo se verifican localmente. El typecheck del frontend ni siquiera podía correr hasta la Parte 3. Sin un gate automático, las regresiones vuelven a entrar.

## Goals

- Workflow CI en GitHub Actions con dos jobs:
  - **backend**: `ruff check` (reglas seguras E4/E7/E9/F) + `pytest -q`.
  - **frontend**: `npm ci` + `typecheck` + `vitest run` + `build`.
- Config de ruff y pytest en `pyproject.toml` (line-length 100, target py313, testpaths).
- Todo el gate pasa en local antes de merge.

## Non-goals

- No endurecer ruff a reglas de estilo (E/F inicial; estilos y `strict` TS son cambios futuros).
- No añadir ESLint/Prettier (fuera de alcance).
- No CI de deploy (Dokploy despliega por compose).

## How

1. `uv add --dev ruff` + `[tool.ruff]` + `[tool.pytest.ini_options]` en `backend/pyproject.toml`.
2. Correr `uv run ruff check app tests` y arreglar hallazgos.
3. `.github/workflows/ci.yml`: jobs `backend` (astral-sh/setup-uv, `uv sync --frozen`, ruff, pytest) y `frontend` (setup-node 20, `npm ci`, typecheck, `vitest run`, build).
4. Verificar todo el pipeline en local.

## Impact

Tooling/CI únicamente; sin cambios de comportamiento (skip_specs).