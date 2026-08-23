# Contexto del Problema

## Situación actual

- El monitoreo de las áreas de riego se hace de forma manual y sin datos en tiempo real: el productor no tiene visibilidad remota del estado de cada área (humedad, flujo de riego, clima).
- Los sensores físicos no están accesibles para el desarrollo; el hardware se **simula** con un script local que emite lecturas HTTP cada 10 minutos hacia el servidor (144 lecturas/día por nodo).
- La infraestructura corre en una VPS Linux ("Servidor Grogu") desplegada con Docker Compose y Dokploy.

## Dolores identificados

1. **Sin visibilidad remota**: para saber si un área está recibiendo agua, hay que ir al campo o confiar en reportes manuales.
2. **Decisión de riego a ciegas**: sin humedad del suelo ni E.T.O., el riego se programa por calendario, no por necesidad del cultivo.
3. **Detección tardía de fallas**: si un nodo o una bomba deja de operar, el productor se entera tarde (no hay alerta por inactividad en el MVP; el indicador de frescura lo hace visible).
4. **Sin histórico**: no hay trazabilidad por temporada (ciclo de cultivo) para comparar años y aprender qué funcionó.
5. **Datos dispersos**: cada lectura tiene 12 campos en 3 categorías (suelo, riego, ambiental); sin un sistema, esos datos no quedan organizados ni consultables.

## Impacto del problema

- Desperdicio de agua y energía por riego excesivo, o pérdida de producción por déficit hídrico.
- Sin datos históricos, no se puede justificar inversión en infraestructura de riego.
- Dependencia de inspección física para cualquier diagnóstico.

## Lo que el MVP cubre

- Ingesta automática de lecturas (3 categorías dinámicas) cada 10 minutos por nodo.
- Dashboard con énfasis en los **3 datos prioritarios**: humedad del suelo, flujo por minuto y E.T.O.
- **Indicador de frescura**: último dato + tiempo transcurrido por nodo/área.
- Histórico con filtros de fecha, presets (semana/mes/año) y ciclos de cultivo; exportación CSV/Excel/PDF.
- Roles: Admin gestiona todo; Cliente solo ve sus predios/áreas.

## Lo que NO es el MVP (roadmap, ver `docs/product/high-level-requirements.md`)

- IA conversacional y reportes automáticos.
- Alertas automáticas por umbral e inactividad (backend) con notificaciones email/WhatsApp.
- Mapa geoespacial avanzado (la base geoespacial ya existe como parte del desarrollo).
- NDVI (índice de vegetación).

## [TODO: completar]

- Descripción del proceso actual real del productor (p. ej. "se registra en Excel…").
- Datos del socio formador: ubicación, número de predios/áreas, cultivos.
- Costos concretos del problema (agua, energía, horas-hombre) si los tiene el cliente.