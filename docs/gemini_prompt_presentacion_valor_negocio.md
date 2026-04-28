# Prompt Maestro para Gemini - Presentacion Ejecutiva (ROI y Valor de Negocio)

> Copia y pega **todo este contenido** en Gemini.
> Objetivo: que Gemini te entregue una presentacion lista para exponer al cliente con enfoque 100% negocio.

---

## INSTRUCCIONES PARA GEMINI (COPIAR DESDE AQUI)

Actua como consultor senior de estrategia de producto B2B para AgriTech y CFO advisor.
Necesito que crees una presentacion ejecutiva para un cliente final que evaluara continuidad y expansion del sistema.

### 1) Objetivo de la presentacion

Construir un caso claro de **valor economico y operativo** de una solucion de monitoreo de riego IoT que ya esta operando.
La presentacion debe mover a una decision de negocio, no a una discusion tecnica.

### 2) Contexto del sistema (hechos reales que debes usar)

La solucion ya esta implementada y operativa en produccion con:

- Monitoreo de riego en web (cliente/admin).
- Dashboard con indicadores prioritarios: humedad de suelo, flujo de agua, ETO.
- Indicador de frescura de datos (ultimo dato y tiempo sin reporte).
- Alertas por umbrales + alertas por inactividad.
- Centro de alertas y preferencias de notificacion.
- Notificaciones por correo y WhatsApp.
- Historico con filtros por fecha y exportacion CSV/XLSX/PDF.
- Mapa geoespacial de nodos (cliente y admin).
- Operacion administrativa multi-cliente, multi-predio, multi-area.
- Gestion administrativa completa con acciones de editar/borrar en:
  - clientes
  - predios
  - areas de riego
  - catalogo de cultivos
- Auditoria de acciones.
- Reportes IA y asistente IA conversacional con contexto operativo.
- Pantalla de consumo/uso IA para control administrativo.
- Cierre de sesion disponible en escritorio y telefono.

Arquitectura operativa:

- Frontend web + backend API + base de datos.
- Despliegue en VPS Linux con Docker Compose y proxy reverse.
- Control de acceso por roles (admin/cliente) y ownership de datos.
- Ingesta IoT con API key por nodo.

### 3) Restricciones obligatorias de narrativa

No uses:

- framing de "MVP", "piloto", "prototipo", "pendiente", "fase temprana".
- n8n en ningun slide.
- lenguaje academico o exceso de jerga tecnica.

Si mencionas tecnologia, debe ser solo para respaldar confianza, nunca para protagonizar la historia.

### 4) Regla de oro (obligatoria en toda la salida)

Por cada feature mostrada, debes traducirla a valor de negocio con este patron:

`Feature -> KPI de negocio -> Formula de impacto -> Resultado economico esperado (MXN)`

Ejemplo de estilo:
"Esta vista reduce X horas de inspeccion manual por semana, equivalente a Y MXN/mes."

### 5) Marco financiero que debes usar

- Moneda: **MXN**
- Horizonte: **12 meses**
- Modelo: **escenarios por rangos** (Bajo / Base / Alto)
- No inventes cifras finales como hechos.
- Si no hay dato exacto, usa placeholders parametrizables y explicita la formula.

Formulas obligatorias:

1. `Ahorro agua = (consumo base - consumo optimizado) * tarifa agua`
2. `Ahorro energia = (kWh base - kWh optimizado) * tarifa CFE`
3. `Ahorro mano de obra = horas evitadas * costo_hora * periodos`
4. `Valor riesgo evitado = prob_evento * perdida_promedio_evitable`
5. `Costo IA = (tokens_in + tokens_out) * precio_token + overhead`
6. `Costo operativo total = infraestructura + soporte + mantenimiento + IA + monitoreo`
7. `ROI% = (beneficio_neto / costo_total) * 100`
8. `Payback (meses) = inversion_inicial / beneficio_mensual_neto`

### 6) Mapa Feature -> Valor que debes cubrir explicitamente

1. Dashboard + frescura:
   - valor: menos inspeccion manual en campo y deteccion rapida de nodos caidos.
2. Alertas / umbrales / notificaciones:
   - valor: prevenir estres hidrico, fallas y merma de cosecha.
3. Historico / exportacion:
   - valor: trazabilidad para decisiones, auditoria y reporteo operativo.
4. Mapa operativo:
   - valor: menor tiempo de diagnostico y coordinacion tecnica.
5. Reportes IA + Asistente IA:
   - valor: menos tiempo de analisis, decisiones mas consistentes y accionables.
6. Consumo IA (admin):
   - valor: gobernanza y control de costo IA.

### 7) Estructura fija que debes entregar (12 a 14 slides)

Debes generar exactamente estas secciones en orden:

1. Portada ejecutiva orientada a resultado.
2. Dolor economico actual (costo de ineficiencia sin plataforma).
3. Como la solucion reduce costos directos (agua, energia, mano de obra).
4. Como la solucion reduce riesgo operativo y financiero.
5. Escalabilidad y control multi-nivel para crecimiento.
6. Inteligencia de negocio: de reaccion a prediccion asistida por IA.
7. Costo operativo anual del sistema (TCO) con desglose.
8. Costo de IA y estrategia de control de consumo.
9. Modelo financiero 12 meses (Bajo/Base/Alto).
10. ROI y Payback (tabla y lectura ejecutiva).
11. Evidencias del sistema en operacion (pantallas reales + metrica asociada).
12. Plan 90 dias (adopcion, disciplina operativa y optimizacion de costo).
13. Decision recomendada (aprobar, escalar, con guardrails financieros).
14. Cierre y siguiente paso concreto.

### 8) Evidencias visuales que debes pedir en la presentacion

Para cada slide funcional, agrega sugerencia de captura real desde estas vistas:

- Cliente:
  - `/cliente`
  - `/cliente/historico`
  - `/cliente/exportar`
  - `/cliente/alertas`
  - `/cliente/mapa`
  - `/cliente/notificaciones`
  - `/cliente/umbrales`
  - `/cliente/reportes-ia`
  - `/cliente/asistente-ia`

- Admin:
  - `/admin`
  - `/admin/alertas`
  - `/admin/mapa`
  - `/admin/auditoria`
  - `/admin/reportes-ia`
  - `/admin/consumo-ia`

Incluye una tabla:
`Pantalla real -> KPI de negocio -> formula -> impacto estimado MXN`.

### 9) Formato de salida obligatorio

Entregame 4 bloques:

#### Bloque A - Deck slide-by-slide

Para cada slide:

- Titulo
- Objetivo de negocio
- 3 bullets maximo
- Metrica principal
- Formula economica
- Impacto esperado (en rango)
- Visual sugerido
- Speaker notes (45 a 60 segundos por slide)

#### Bloque B - Modelo financiero editable

Tabla en MXN con:

- Variables de entrada (placeholders)
- Escenario Bajo/Base/Alto
- Costos
- Beneficios
- Beneficio neto
- ROI
- Payback

#### Bloque C - Guion oral de 8 a 10 minutos

Texto continuo para presenter, tono ejecutivo, orientado a decision.

#### Bloque D - Objecciones y respuestas

Minimo 10 objeciones tipo cliente CFO/operaciones y respuesta corta con datos.

### 10) Variables placeholder que debes incluir en el modelo (sin inventar datos finales)

Usa estas variables:

- `consumo_agua_base_m3_mes`
- `consumo_agua_opt_m3_mes`
- `tarifa_agua_mxn_m3`
- `kwh_base_mes`
- `kwh_opt_mes`
- `tarifa_cfe_mxn_kwh`
- `horas_inspeccion_manual_semana`
- `horas_ahorradas_semana`
- `costo_hora_operativa_mxn`
- `prob_evento_critico_anual`
- `perdida_promedio_evento_mxn`
- `costo_infra_mensual_mxn`
- `costo_soporte_mensual_mxn`
- `costo_mantenimiento_mensual_mxn`
- `tokens_in_mes`
- `tokens_out_mes`
- `precio_token_in_mxn`
- `precio_token_out_mxn`
- `overhead_ia_mxn_mes`

### 11) Reglas de calidad final (auto-check)

Antes de cerrar tu salida, valida:

1. No aparece "MVP", "piloto", "n8n", "pendiente".
2. Cada slide funcional tiene metrica y formula.
3. Existe seccion de costo operativo + costo IA.
4. Existe tabla ROI 12 meses en MXN por escenarios.
5. Existe recomendacion ejecutiva final accionable.
6. No hay datos sensibles (tokens, passwords, API keys, secretos).

Genera la salida completa ahora.

## FIN DE INSTRUCCIONES PARA GEMINI
