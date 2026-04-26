# Plan: Fase 2 IA Backend Primero

## Summary

Plan vigente de Fase 2 con enfoque backend-first, sin n8n por el momento:
- Reportes IA programados y manuales.
- Recomendaciones IA en alertas.
- Asistente conversacional IA con contexto operativo real.
- Observabilidad y guardrails del asistente.

## Estado actual (2026-04-26)

### Completado
- Reportes IA backend:
  - `GET /api/v1/ai-reports`
  - `GET /api/v1/ai-reports/{id}`
  - `POST /api/v1/ai-reports/generate`
  - Scheduler diario `ai_report_scheduler`.
- Integración Azure OpenAI con fallback determinístico para reportes y recomendaciones.
- UI de reportes IA:
  - `/cliente/reportes-ia`
  - `/cliente/reportes-ia/:reportId`
  - `/admin/reportes-ia`
  - `/admin/reportes-ia/:reportId`
- Asistente conversacional:
  - `POST /api/v1/ai-assistant/chat`
  - UI: `/cliente/asistente-ia` y `/admin/asistente-ia`
  - Respuesta con texto + widgets dinámicos (KPIs, tabla, tendencia).
- Guardrails del asistente:
  - rate limit por usuario configurable por env.
  - límites de contexto/tokens.
- Observabilidad IA:
  - logging estructurado por request del asistente (source/provider/model/tokens/latencia/status).
  - endpoint admin `GET /api/v1/ai-assistant/usage`
  - UI admin `/admin/consumo-ia`.

### Diferido (intencional)
- n8n como orquestador externo.

## Variables clave (asistente IA)

- `AI_ASSISTANT_ENABLED`
- `AI_ASSISTANT_MAX_AREAS`
- `AI_ASSISTANT_MAX_ALERTS`
- `AI_ASSISTANT_MAX_HISTORY_MESSAGES`
- `AI_ASSISTANT_RATE_LIMIT_WINDOW_MINUTES`
- `AI_ASSISTANT_RATE_LIMIT_MAX_REQUESTS`

## Test plan (estado)

### Cubierto
- Ownership y acceso por rol en reportes y asistente.
- Generación manual de reportes.
- Caso de no-duplicación de reportes por rango cuando `force=false`.
- Caso de falla de generación en reportes (`estado=failed`).
- Scheduler: validación de decisión de ejecución diaria (unidad).
- Asistente:
  - widgets en contrato de respuesta.
  - rate limit (`429`).
  - endpoint admin de uso y bloqueo para cliente (`403`).

### Pendiente recomendado
- Pruebas E2E UI para flujo chat + visualizaciones.
- Pruebas de carga ligera para `/ai-assistant/chat` (latencia y límites).

## Assumptions

- Orquestación principal sigue en backend (FastAPI + schedulers internos).
- n8n queda fuera del alcance actual por decisión de producto.
- Azure OpenAI se usa con contexto preparado por backend (sin acceso directo a MySQL).
