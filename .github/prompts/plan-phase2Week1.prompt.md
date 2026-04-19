## Plan: Fase 2 Semana 1 (Entrega Rapida)

Objetivo: entregar en 1 semana un Phase 2 Lite funcional y demostrable con alertas/umbrales, notificaciones por email, alerta activa por inactividad de nodo, auditoria basica y mapa base con OpenFreeMap + MapLibre. En esta iteracion se prioriza velocidad y bajo riesgo: umbrales solo por Admin, email obligatorio, WhatsApp en iteracion inmediata siguiente.

**Steps**
1. Cerrar alcance y criterios de aceptacion (Dia 1, bloqueante para todo).
Dependencias: ninguna.
Entregable: checklist de historias cerradas para semana 1.
Incluye: confirmar reglas de severidad (info/warning/critical), parametros monitoreados, formato de mensajes email y criterio exacto de inactividad (>=20 min).

2. Backend de datos y contratos API (Dia 1-2, bloquea 3-5).
Dependencias: 1.
Acciones:
- Crear migraciones Alembic para tablas `thresholds` (umbrales), `alerts` (alertas) y `audit_log`.
- Definir modelos SQLAlchemy, schemas Pydantic y servicios para CRUD de umbrales (solo Admin) y listado/marcado de alertas.
- Publicar endpoints versionados `/api/v1/thresholds` y `/api/v1/alerts` con paginacion/filtros.
- Asegurar control de acceso: Admin global; Cliente solo lectura de alertas de sus areas.

3. Motor de alertas por umbral en ingesta (Dia 2-3, depende de 2).
Dependencias: 2.
Acciones:
- Integrar evaluacion de umbrales en flujo de `POST /api/v1/readings`.
- Generar alerta al cruzar umbral con severidad y metadata (parametro, valor, nodo, area, timestamp).
- Evitar duplicado inmediato (idempotencia por ventana corta o regla de cambio de estado).
- Dejar trazabilidad para auditoria en operaciones de creacion/actualizacion.

4. Alerta activa por inactividad de nodos (Dia 3, depende de 2; paralelo con 5).
Dependencias: 2.
Acciones:
- Implementar scheduler liviano en backend (APScheduler) para revisar ultimo dato por nodo cada 5 min.
- Crear alerta `inactivity` cuando el nodo tenga >=20 min sin lecturas.
- Evitar spam de alertas repetidas para el mismo evento de inactividad.

5. Notificaciones por email (Dia 3-4, depende de 2 y 3; paralelo con 4).
Dependencias: 2 y 3.
Acciones:
- Implementar adaptador SMTP con feature flag y reintento simple.
- Disparar email para alertas segun severidad/politica definida.
- Persistir estado de envio en alerta (`sent_email_at` o flag equivalente) para evitar reenvios.

6. Auditoria basica (Dia 4, depende de 2; paralelo con 7).
Dependencias: 2.
Acciones:
- Registrar en `audit_log` cambios de umbrales y acciones sobre alertas (marcar leida/gestion).
- Exponer endpoint de consulta para Admin con filtros basicos (fecha, entidad, usuario).

7. Frontend de operacion (Dia 4-5, depende de 2-5; paralelo con 6 si hay 2 personas).
Dependencias: 2, 3 y 5.
Acciones:
- Admin: pantalla CRUD de umbrales por area.
- Admin/Cliente: bandeja de alertas con filtros por severidad, estado leida/no leida y rango de fecha.
- Indicadores visuales de estado (badge severidad, timestamp, tiempo transcurrido).

8. Mapa base con OpenFreeMap + MapLibre (Dia 5, depende de 2 para datos de nodos; paralelo parcial con 7).
Dependencias: 2.
Acciones:
- Integrar MapLibre GL en frontend usando tiles de OpenFreeMap.
- Mostrar nodos con marcadores por estado (activo, warning, inactivo) usando ultimo timestamp.
- Tooltip/popup minimo con nodo, area, ultimo dato y enlace a historico/alertas.

9. Hardening, pruebas y salida a produccion (Dia 5-6, depende de 3-8).
Dependencias: 3, 4, 5, 6, 7, 8.
Acciones:
- Pruebas unitarias de evaluacion de umbrales y regla de inactividad.
- Pruebas de integracion API para `/thresholds`, `/alerts`, auditoria y permisos por rol.
- Pruebas E2E manuales: crear umbral -> simular lectura fuera de rango -> alerta -> email -> visualizacion en UI/mapa.
- Checklist de despliegue Dokploy: variables SMTP, migraciones, health checks, rollback.

10. Cierre de release y backlog inmediato (Dia 7, depende de 9).
Dependencias: 9.
Acciones:
- Congelar release notes y evidencia de pruebas.
- Definir Iteracion 2 inmediata: WhatsApp Business, preferencias de notificacion por usuario/area, mejoras UX de mapa.

**Relevant files**
- /Users/alanz/Dev/sensorestest/backend/app/api/v1/endpoints/readings.py — integrar evaluacion de umbrales en ingesta y reuso de patrones de filtros/export.
- /Users/alanz/Dev/sensorestest/backend/app/services/reading.py — extender logica de consulta/normalizacion para disparo de alertas.
- /Users/alanz/Dev/sensorestest/backend/app/core/deps.py — reforzar permisos por rol y ownership.
- /Users/alanz/Dev/sensorestest/backend/app/models/ — agregar modelos de umbrales, alertas, auditoria.
- /Users/alanz/Dev/sensorestest/backend/app/schemas/ — contratos request/response de thresholds, alerts, audit log.
- /Users/alanz/Dev/sensorestest/backend/app/services/ — servicios nuevos: thresholds, alerts, notifications, audit.
- /Users/alanz/Dev/sensorestest/backend/alembic/versions/ — migraciones de fase 2 lite.
- /Users/alanz/Dev/sensorestest/backend/pyproject.toml — dependencias (apscheduler, cliente SMTP).
- /Users/alanz/Dev/sensorestest/frontend/src/app/services/api.ts — clientes API para thresholds/alerts/audit.
- /Users/alanz/Dev/sensorestest/frontend/src/app/pages/admin/ — nueva vista de umbrales.
- /Users/alanz/Dev/sensorestest/frontend/src/app/pages/client/ — bandeja de alertas y vista de mapa.
- /Users/alanz/Dev/sensorestest/frontend/package.json — dependencias MapLibre GL.
- /Users/alanz/Dev/sensorestest/docker-compose.yml — variables y ajustes de despliegue para SMTP/scheduler.
- /Users/alanz/Dev/sensorestest/docs/documentacion_api.md — documentar nuevos endpoints y ejemplos.
- /Users/alanz/Dev/sensorestest/docs/documentacion_base_de_datos.md — documentar tablas activadas en fase 2.

**Verification**
1. Ejecutar migraciones en entorno local y validar esquema: alembic upgrade head.
2. Correr suite backend (unit + integration) enfocada en thresholds/alerts/audit y permisos por rol.
3. Probar simulador enviando lecturas controladas fuera de umbral y confirmar creacion de alertas.
4. Verificar envio de email con SMTP sandbox y registrar estado de entrega en BD.
5. Validar job de inactividad con reloj controlado (>=20 min) y no-duplicacion de alertas.
6. Validar frontend: CRUD de umbrales (Admin), bandeja de alertas (Admin/Cliente), marcado de leidas.
7. Validar mapa MapLibre/OpenFreeMap: render, marcadores y popup con estado de nodo.
8. Build y smoke test de despliegue: frontend build, backend boot, health endpoint, rutas via proxy.

**Decisions**
- Horizonte: entrega de Fase 2 en 1 semana.
- Equipo: 1-2 personas.
- Prioridad: entrega rapida con minimo viable funcional.
- Umbrales/canales: configuracion solo por Admin en esta entrega.
- Notificaciones: email obligatorio; WhatsApp pasa a iteracion 2 inmediata.
- IA/n8n: fuera de esta entrega para cumplir tiempo y reducir riesgo.

**Scope boundaries**
- Incluido en semana 1: umbrales, alertas por lectura, inactividad activa, email, auditoria basica, mapa base.
- Excluido de semana 1: WhatsApp productivo, preferencias avanzadas por usuario/canal, IA/n8n, analitica nocturna, NDVI.

**Further Considerations**
1. Estado de despliegue recomendado: usar un unico contenedor backend + scheduler embebido para acelerar; migrar a worker separado en iteracion 2 si aumenta carga.
2. Riesgo principal de semana 1: spam/duplicado de alertas; mitigar con regla de cambio de estado e idempotencia por ventana.
3. Criterio de aceptacion ejecutivo: demo en vivo de flujo completo desde lectura fuera de umbral hasta alerta visible + email recibido + nodo visible en mapa.
