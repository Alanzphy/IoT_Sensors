# Plan: Fase 2 IA Backend Primero

## Summary

Implementar primero reportes nocturnos con IA desde el backend, sin n8n en la primera version. El backend agregara datos reales, enviara un contexto compacto a Azure OpenAI, guardara el reporte generado y notificara al cliente con un link corto por WhatsApp/email. n8n queda como opcion futura si aparece necesidad real de flujos visuales o integraciones externas.

## Key Changes

- Crear modulo de reportes IA en FastAPI:
  - Generacion diaria nocturna por cliente/area.
  - Analisis del dia anterior: humedad de suelo, flujo/consumo, ETO, alertas, inactividad y frescura de nodos.
  - Recomendaciones agronomicas redactadas por IA, basadas solo en datos agregados del sistema.
- Agregar persistencia de reportes:
  - Tabla principal tipo `ai_reports` con cliente, area opcional, rango analizado, estado, resumen, hallazgos, recomendacion, timestamps y metadatos de generacion.
  - Guardar errores si falla Azure OpenAI para poder auditar/reintentar.
- Agregar APIs:
  - `GET /api/v1/ai-reports` listado paginado con ownership por rol.
  - `GET /api/v1/ai-reports/{id}` detalle del reporte.
  - `POST /api/v1/ai-reports/generate` endpoint admin/scheduler para generar reporte manual o nocturno.
- Agregar frontend:
  - Nueva seccion cliente: `/cliente/reportes-ia`.
  - Nueva vista detalle: `/cliente/reportes-ia/:reportId`.
  - Admin puede consultar reportes por cliente/area.
- Agregar scheduler propio:
  - Servicio tipo `ai_report_scheduler`, similar a `notification_scheduler`.
  - Cadencia inicial: nocturno diario.
  - Configurable por env vars.
- Integrar notificacion:
  - Al terminar un reporte, enviar WhatsApp/email corto con link al reporte.
  - No enviar el reporte completo por WhatsApp.
- Mantener n8n fuera de v1:
  - No agrega valor suficiente todavia porque el proyecto ya tiene schedulers propios.
  - Se podra incorporar despues como orquestador externo llamando los mismos endpoints.

## Test Plan

- Unit tests de agregacion de datos para reportes.
- Integration tests de ownership:
  - Cliente solo ve sus reportes.
  - Admin ve todos y filtra por cliente/area.
- Test de generacion manual con datos demo.
- Test de fallo Azure OpenAI:
  - Reporte queda en estado `failed`.
  - Error queda persistido.
  - No se envia notificacion de exito.
- Test de scheduler:
  - Genera reportes una vez por ventana.
  - No duplica reportes del mismo cliente/area/rango.
- Frontend build y prueba manual:
  - Listado de reportes.
  - Detalle de reporte.
  - Link desde WhatsApp abre el reporte.

## Assumptions

- Primera version IA = reportes nocturnos, no chat.
- Orquestacion inicial = backend scheduler, no n8n.
- Entrega = reporte completo en web + aviso corto por WhatsApp/email.
- Proveedor = Azure OpenAI mediante configuracion por variables de entorno.
- La IA no consulta MySQL directamente; el backend prepara el contexto seguro y filtrado.
- El chat conversacional queda para una etapa posterior, reutilizando APIs y agregaciones creadas para reportes.
