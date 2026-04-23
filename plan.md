## Plan: Demo Data Seed + Real-time Simulator

Objetivo: reemplazar datos históricos existentes de la cuenta alan2203mx@gmail.com por un dataset coherente de 30 días para todas sus áreas/nodos, crear umbrales mixtos (info/warning/critical) en parámetros prioritarios, y luego ajustar simulator_fast.py para operar como sensor en vivo mostrando datos y alertas en tiempo real.

**Steps**
1. Fase 1 - Snapshot y validación de alcance (bloqueante)
1.1 Confirmar en runtime los IDs reales de usuario, cliente, predios, áreas y nodos de alan2203mx@gmail.com, más conteos actuales de lecturas/alertas/umbrales por área.
1.2 Guardar snapshot previo (conteos + min/max timestamps) para poder validar que la purga y recarga fueron correctas.
1.3 Verificar que cada área tenga nodo activo 1:1; si un área no tiene nodo activo, reportar y excluirla explícitamente del seed de lecturas.

2. Fase 2 - Purga controlada de datos existentes del cliente (depende de 1)
2.1 Eliminar solo datos derivados de sensores de las áreas del cliente: alertas y lecturas (hard delete, scope por area_id/node_id del cliente).
2.2 Limpiar umbrales anteriores del cliente para evitar mezcla de reglas en demo (soft delete siguiendo convenciones del proyecto).
2.3 Conservar estructuras estáticas (cliente, predios, áreas, nodos, ciclos) para no romper navegación ni ownership.
2.4 Validar post-purga con conteos en cero para lecturas/alertas en esas áreas.

3. Fase 3 - Script de carga histórica coherente sin usar simulador (depende de 2)
3.1 Implementar script de seed histórico dedicado (no endpoint de simulador), ejecutado desde backend con sesión SQLAlchemy.
3.2 Generar 30 días por nodo con cadencia de 10 minutos (144 lecturas/día/nodo), timestamps UTC ISO coherentes, variación diurna y continuidad por nodo.
3.3 Reglas de coherencia física: radiación y temperatura con ciclo solar, ETo correlacionada con radiación/temperatura/viento, humedad de suelo con dinámica de riego/evaporación, flujo y litros acumulados consistentes.
3.4 Inyectar valores no disponibles ocasionales (0 o null) en baja frecuencia para reflejar casos reales sin degradar visualización.
3.5 Insertar en batch por nodo para eficiencia, con commit por bloques y reporte final por área/nodo.

4. Fase 4 - Configuración de umbrales mixtos para demo (depende de 2; paralela con 3 si se desea)
4.1 Crear umbrales activos por cada área en los 3 parámetros prioritarios: soil.humidity, irrigation.flow_per_minute, environmental.eto.
4.2 Asignar severidad mixta por área usando las tres severidades (info/warning/critical) distribuidas entre esos parámetros.
4.3 Definir rangos deliberadamente realistas pero sensibles para permitir breaches visibles durante demo en vivo.
4.4 Verificar unicidad área+parámetro y que no existan duplicados activos.

5. Fase 5 - Ajuste de simulator_fast.py para demo en tiempo real (depende de 4)
5.1 Extender simulator_fast.py para modo multi-nodo (lista de API keys) y estado independiente por nodo.
5.2 Agregar modo demo de alertas controladas (picos periódicos) para disparar breaches en umbrales sin perder coherencia general.
5.3 Mantener modo actual rápido y compatibilidad con backfill/dry-run, separando explícitamente real-time demo vs backfill.
5.4 Añadir salida de consola orientada a demo (nodo, área lógica, parámetros prioritarios y probables breaches).

6. Fase 6 - Verificación integral funcional (depende de 3, 4, 5)
6.1 Validación de BD: conteos esperados por nodo (30 x 144), min/max de fechas dentro de ventana, y continuidad temporal sin huecos anómalos.
6.2 Validación API: GET /api/v1/readings con filtros start_date/end_date por varias áreas; verificar paginación y exportable.
6.3 Validación UI (cuenta alan2203mx@gmail.com): histórico con presets/rango libre, dashboard con prioridad visible, y alertas apareciendo durante ejecución del simulador en vivo.
6.4 Validación de umbrales/alertas: confirmar creación de alertas threshold al ingresar lecturas out-of-range, deduplicación 10 min y visibilidad en Centro de Alertas.

7. Fase 7 - Entrega operativa (depende de 6)
7.1 Entregar comandos exactos: purga + seed histórico + creación de umbrales + arranque simulador en vivo.
7.2 Entregar checklist de demo (orden recomendado de pantallas y filtros) y parámetros para repetir la carga en otro ambiente.

**Relevant files**
- /Users/alanz/Dev/sensorestest/backend/app/models/reading.py - Esquema de lecturas y constraints de datos históricos.
- /Users/alanz/Dev/sensorestest/backend/app/models/alert.py - Estructura de alertas generadas por umbrales/inactividad.
- /Users/alanz/Dev/sensorestest/backend/app/models/threshold.py - Entidad de umbrales y estado activo/eliminado.
- /Users/alanz/Dev/sensorestest/backend/app/services/reading.py - Lógica de ingestión y generación de alertas por breach.
- /Users/alanz/Dev/sensorestest/backend/app/services/alert.py - Escaneo/consulta de alertas para validación de demo.
- /Users/alanz/Dev/sensorestest/backend/app/services/threshold.py - Creación/validación de umbrales por área y parámetro.
- /Users/alanz/Dev/sensorestest/backend/app/core/deps.py - Validación de API key de nodos (necesaria para modo sensor en vivo).
- /Users/alanz/Dev/sensorestest/backend/app/db/session.py - Sesión de BD para script de carga masiva.
- /Users/alanz/Dev/sensorestest/backend/tests/integration/test_notification_preferences_api.py - Referencia de comportamiento de alertas/notificaciones en pruebas.
- /Users/alanz/Dev/sensorestest/simulator/simulator_fast.py - Simulador a ajustar para demo real-time multi-nodo.
- /Users/alanz/Dev/sensorestest/frontend/src/app/pages/client/HistoricalData.tsx - Requisitos de histórico y filtros por fecha.
- /Users/alanz/Dev/sensorestest/frontend/src/app/pages/shared/AlertsCenterPage.tsx - Visualización y filtros de alertas en demo.

**Verification**
1. Ejecutar chequeos SQL/API antes y después de purga para confirmar scope exclusivo del cliente alan2203mx@gmail.com.
2. Validar que el total de lecturas por nodo coincide con 30 días x 144 y que los timestamps cubren todo el rango.
3. Validar que cada área tiene 3 umbrales activos en parámetros prioritarios, con severidad mixta.
4. Levantar backend+frontend, iniciar simulador en vivo y confirmar aparición incremental de lecturas y alertas en UI.
5. Ejecutar pruebas backend relevantes (incluyendo integración de alertas/preferencias si hay cambios de lógica asociados al seed/simulador).

**Decisions**
- Alcance confirmado: solo alan2203mx@gmail.com (todos sus predios/áreas).
- Rango histórico confirmado: 30 días.
- Umbrales confirmados: perfil mixto por área usando info/warning/critical sobre los 3 parámetros prioritarios.
- Incluye: purga de datos dinámicos del cliente, recarga histórica coherente, creación de umbrales demo y ajuste de simulador real-time.
- Excluye: cambios de arquitectura, IA/n8n/agentes autónomos, modificaciones de entidades estáticas (cliente/predio/área/nodo).

**Further Considerations**
1. Recomendado: persistir en un archivo de configuración las API keys de todos los nodos de alan para iniciar demo en un solo comando.
2. Recomendado: dejar un flag de semilla determinística en el script histórico para reproducir exactamente el mismo dataset cuando se necesite.
3. Recomendado: agregar modo "demo-safe" en simulador para controlar frecuencia de breaches y evitar saturación de alertas.


**Handoff Context Pack (portable para otra IA/agente)**

1. Estado operativo observado en esta sesión
- Repo raíz: /Users/alanz/Dev/sensorestest
- Rama activa al último chequeo: main
- Entorno Python backend configurado: /Users/alanz/Dev/sensorestest/backend/.venv/bin/python
- El backend y frontend ya estan levantados, no necesitas intentar hacerlo

2. Restricciones funcionales confirmadas para este trabajo
- Alcance de datos: solo cuenta alan2203mx@gmail.com.
- Borrar y recargar únicamente datos dinámicos del cliente (lecturas, alertas y umbrales previos del cliente), conservando entidades estáticas.
- Cobertura completa del cliente: todos sus predios, áreas y nodos activos vinculados.
- Carga histórica objetivo: 30 días, cadencia de 10 minutos por nodo (144 lecturas/día/nodo).
- Umbrales demo: 3 parámetros prioritarios por área (soil.humidity, irrigation.flow_per_minute, environmental.eto) con severidad mixta info/warning/critical.

3. Hallazgos técnicos clave ya investigados
- Ingesta de lecturas usa API key de nodo mediante header X-API-Key y endpoint POST /api/v1/readings.
- La creación de lecturas dispara generación de alertas de umbral automáticamente.
- Dedupe de alertas threshold: ventana de 10 minutos por area+nodo+parametro+severidad.
- Inactivity genera alertas critical (no info/warning para inactivity en lógica actual).
- Despacho de notificaciones ya está actualizado a evaluación por ambos canales (email y whatsapp) según preferencias por tipo+severidad+canal.
- Relación nodo-area es 1:1; no modificar mapeos sin necesidad.

4. Orden seguro de purga recomendado (scoped por áreas/nodos del cliente)
- Paso A: resolver IDs reales en runtime (user -> client -> properties -> irrigation_areas -> nodes).
- Paso B: eliminar alertas del cliente (por area_riego_id y/o nodo_id del cliente).
- Paso C: eliminar lecturas del cliente (por nodo_id del cliente).
- Paso D: limpiar preferencias de notificación del cliente si se requiere reset completo de demo.
- Paso E: limpiar umbrales previos del cliente para no mezclar reglas (respetando convención del proyecto).
- Paso F: validar conteos en cero para lecturas/alertas del scope antes de recargar.

5. Dataset mínimo para que la demo se vea bien
- Rango temporal con continuidad diaria y variación diurna visible.
- Prioritarios siempre presentes en la mayor parte de puntos: soil.humidity, irrigation.flow_per_minute, environmental.eto.
- Variabilidad física coherente: radiación/temperatura/eto correlacionadas, humedad con dinámica de riego-evaporación.
- Algunas ausencias controladas (0/null) de baja frecuencia para realismo sin dañar gráficos.

6. Preflight checklist (obligatorio antes de ejecutar)
- Confirmar usuario objetivo existe: alan2203mx@gmail.com.
- Confirmar áreas y nodos activos a intervenir (lista explícita en salida).
- Confirmar backup/snapshot de conteos y min/max timestamp antes de purga.
- Confirmar timezone de generación en UTC.
- Confirmar que no se tocarán datos de otros clientes.

7. Post-load checklist (obligatorio)
- Conteos de lecturas esperados por nodo: 30 x 144.
- Min/max timestamps dentro de ventana objetivo por nodo.
- Umbrales activos por área: exactamente 3 prioritarios con severidad mixta.
- Histórico UI muestra datos por rango libre y presets.
- Alertas UI empieza a poblarse con breaches durante simulación en vivo.

8. Contexto de simulador para fase real-time
- simulator_fast.py actual está orientado a pruebas rápidas y single-key por ejecución.
- Debe extenderse a modo multi-nodo con estado independiente por nodo y salida orientada a demo.
- Mantener compatibilidad con dry-run y modos existentes.

9. Comandos de control sugeridos para handoff (verificar/adaptar antes de correr)
- Estado git: git status --short
- Identificar ramas: git branch --show-current
- Ejecutar pruebas backend relevantes tras cambios: /Users/alanz/Dev/sensorestest/backend/.venv/bin/python -m pytest tests/integration/test_notification_preferences_api.py -q
- Verificación de datos por fechas: usar script/check SQL de conteos por nodo y min/max marca_tiempo.

10. Riesgos conocidos y mitigaciones
- Riesgo: purga fuera de scope por joins incorrectos. Mitigación: siempre construir lista cerrada de area_ids/node_ids del cliente antes de DELETE.
- Riesgo: dataset incoherente visualmente. Mitigación: usar generador con ciclos diurnos y límites físicos por parámetro.
- Riesgo: no aparecen alertas en vivo. Mitigación: umbrales sensibles pero realistas + modo demo-safe con picos controlados.
- Riesgo: dependencia de contexto no persistente. Mitigación: usar esta sección como fuente de verdad para cualquier agente externo.
