# Proposal: Consolidar docs y specs (segunda pasada de síntesis)

## Problem

Tras la Parte 1 quedó documentación todavía fragmentada y redundante: specs OpenSpec demasiado granulares (7 capacidades), docs de API de 2,007 líneas que duplican el contrato autogenerado, 3 archivos de testing separados, flujos/planes ya cubiertos por specs, `.agent/` con una doc de BD duplicada, y duplicados de skills de Copilot en `.github/`.

## Goals

- Specs: 7 → **6 capacidades** (`readings` = ingesta + consulta/export; `user-auth` → `security`).
- `docs/documentacion_api.md`: 2,007 → ~158 líneas (guía de convenciones + tabla de recursos; detalle en `openapi.yaml` + specs).
- Testing: 3 archivos → **1** (`docs/testing.md`).
- Eliminar: `flujos_backend.md`, `flujos_frontend.md`, `plan_fase2_ia_backend_primero.md` (cubiertos por specs/README), `.agent/agente_base_de_datos.md` (duplica `documentacion_base_de_datos.md` + modelos), `.github/skills/` + `.github/prompts/` (duplicados de Copilot de las skills de `.agent/`).
- README: tabla de documentación actualizada.

## Non-goals

- No tocar `docs/deliverables/` (entregables del cliente, congelados; el Reporte QA conserva links históricos a flujos).
- No tocar las skills/workflows de `.agent/` (infraestructura del flujo OpenSpec).

## How

La reorganización de specs (merge/rename de capacidades) se hizo directamente sobre `openspec/specs/` porque el formato de delta no soporta merges de capacidades; `openspec validate --specs` verifica el resultado (6/6).

## Impact

docs/: 12 archivos → 8; openspec/specs/: 7 → 6; `.github/`: solo CI + workflows.