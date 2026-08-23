# Tasks

## Specs

- [x] Fusionar `sensor-ingest` + `readings-api` → `openspec/specs/readings/spec.md` (9 requisitos, sin pérdida de contenido).
- [x] Renombrar `user-auth` → `openspec/specs/security/` (requisitos de auth + hardening ya incluidos).
- [x] `openspec validate --specs`: 6/6.

## docs/

- [x] `documentacion_api.md`: 2,007 → 158 líneas (convenciones + auth + tabla de 67 operaciones verificada contra openapi.yaml; referencia a specs por capacidad).
- [x] `testing_backend.md` + `testing_frontend.md` → fusionados en `testing.md` (84 líneas).
- [x] Eliminar `flujos_backend.md`, `flujos_frontend.md`, `plan_fase2_ia_backend_primero.md`.
- [x] `documentacion_base_de_datos.md`: referencia a `.agent/agente_base_de_datos.md` → specs/alembic.

## Raíz / .agent / .github

- [x] Eliminar `.agent/agente_base_de_datos.md`, `.github/skills/`, `.github/prompts/`.
- [x] README: tabla de documentación actualizada (openspec primero, docs vivos, deliverables).

## Verify

- [x] `openspec validate --specs` 6/6; sin referencias rotas fuera de `deliverables/`.