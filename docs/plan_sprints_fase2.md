# Plan de Sprints - Fase 2 Completa

Estado base: Fase 2 Lite finalizada.
Fecha de actualizacion: 2026-04-18.

## Sprint 1 - Geoespacial Base (COMPLETADO)
Objetivo:
- Entregar un mapa operativo con nodos por ownership y estado de frescura.

Decision de stack del sprint:
- Motor de mapas: MapLibre GL JS.
- Estilo/cartografia base inicial: OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`).
- Estrategia de riesgo: mantener configurable la URL de estilo para migrar a self-host o proveedor con SLA sin reescritura de UI.

Estado actual de implementacion:
- En backend se habilito `GET /api/v1/nodes/geo` con filtros y ownership por rol.
- En frontend se habilito `ClientMapPage` en `/cliente/mapa` con marcadores y fallback de nodos sin GPS.
- En frontend se habilito `AdminMapPage` en `/admin/mapa` con filtros globales cliente/predio/area.
- Se agrego modo de visualizacion con clusters y capas por estado de frescura (fresco/tardio/sin lectura) para operacion administrativa.
- Se agregaron leyendas persistentes con conteos de estado en mapa cliente y mapa admin.
- Se habilito carga diferida (lazy loading) para rutas de mapas (`/cliente/mapa`, `/admin/mapa`).
- Se habilito prefetch condicional de rutas de mapa desde navegacion desktop y movil.
- Se aplico particion de chunks de frontend para aislar modulos pesados (mapas, charts, router, radix).
- Se agregaron pruebas de integracion backend para permisos/filtros del endpoint geoespacial.

Entregables:
- Endpoint backend geoespacial (ownership por rol).
- Vista frontend de mapa con marcadores por nodo.
- Vista frontend administrativa de mapa global por jerarquia.
- Clustering y capas por estado en mapa admin.
- Leyenda y conteos de estado en mapas cliente/admin.
- Integracion de navegacion cliente hacia la vista mapa.
- Integracion de navegacion admin hacia la vista mapa.
- Prefetch condicional de rutas de mapas.
- Carga diferida de pantallas de mapa.
- Fallback para nodos sin coordenadas.

Criterios de aceptacion:
- Cliente solo visualiza sus nodos.
- Admin puede consultar global y filtrar por jerarquia.
- Mapa muestra ultimo dato y minutos sin actualizacion por nodo.
- Primera carga general optimizada con split de modulos geoespaciales.
- Pruebas de permisos y build frontend en verde.

## Sprint 2 - NDVI
Objetivo:
- Integrar NDVI a ingesta, historicos y exportacion.

Entregables:
- Migracion de BD y modelos.
- Contrato API actualizado.
- UI de historico/dashboard y exportacion con NDVI.

## Sprint 3 - Notificaciones Avanzadas
Objetivo:
- Reglas de horario y ventanas de silencio por cliente/area/canal.

Entregables:
- Preferencias extendidas y motor de despacho horario.
- Cobertura de pruebas y docs de configuracion.

## Sprint 4 - Analitica Asincrona (n8n + Azure OpenAI)
Objetivo:
- Reportes nocturnos y deteccion de patrones/anomalias.

Entregables:
- Pipeline batch desacoplado.
- Persistencia y consulta de reportes.

## Sprint 5 - Asistente Conversacional (Azure OpenAI)
Objetivo:
- Chat con consultas operativas en tiempo real usando function calling.

Entregables:
- Capa de consultas seguras por ownership.
- Guardrails, auditoria y limites de uso.
