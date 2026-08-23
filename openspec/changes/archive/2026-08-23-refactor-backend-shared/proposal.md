# Proposal: Refactor backend shared (dedup + split god services)

## Problem

La auditoría cuantificó duplicación sistemática y servicios-god que hacen costoso cualquier cambio:

- Authz de áreas de cliente (`_get_client_area_ids` y variantes) copiada en ~5 endpoints.
- `_require_admin` local duplicando `deps.require_admin` en ~4 endpoints.
- `SchedulerApiClient` (~85 líneas) copiado 3 veces en los 3 jobs.
- Envío de email SMTP en 3 variantes (alert, ai_report, password_reset).
- `utc_now`/`utc_now_naive` reimplementados en ≥10 sitios.
- God services: `alert.py` (1,367 líneas), `ai_chat.py` (922).
- Código muerto: propiedades self-returning en `models/reading.py`, `passlib` sin uso.

## Goals

- Una sola implementación por helper compartido (authz, scheduler client, email, utc).
- `alert.py` y `ai_chat.py` divididos por responsabilidad sin cambiar comportamiento.
- Código muerto eliminado; dependencia `passlib` retirada.

## Non-goals

- No cambiar contrato API, mensajes, ni comportamiento observable (refactor puro).
- No tocar frontend.

## How

- `app/core/`: `authz.py` (scope de áreas por rol), `time.py` (utc_now), `emailer.py` (SMTP), `scheduler_client.py` (login/refresh/HTTP).
- Schedulers y endpoints importan los helpers compartidos.
- `alert.py` → paquete `services/alerts/` con sub-módulos por responsabilidad (threshold, inactivity, dispatch, ai-recommendation, queries); `services/__init__.py` re-exporta `alert` para no romper imports.
- `ai_chat.py` → módulos de contexto/orquestación/fallback/usage.
- Eliminar propiedades muertas y `passlib`.

## Impact

Refactor interno; specs de capacidades no cambian (comportamiento idéntico, verificado por la suite de 327 tests).