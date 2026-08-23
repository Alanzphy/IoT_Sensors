# Exploración de Soluciones (Alternativas y Trade-offs)

> Nivel producto/negocio: qué se consideró y por qué se eligió el enfoque actual. Las decisiones técnicas de arquitectura viven en `docs/architecture/decisions.md`.

## Alternativas consideradas

| Alternativa | Trade-off | Veredicto |
|---|---|---|
| **Status quo: monitoreo manual / Excel** | Cero inversión, pero sin datos en tiempo real, sin alertas, sin histórico confiable | ❌ No resuelve el problema |
| **SaaS genérico de IoT / SCADA industrial** | Rápido de contratar, pero UI industrial rígida, costo por nodo, sin personalización agro (bento/orgánico), datos fuera del control del cliente | ❌ No encaja con la UX premium y el control deseado |
| **Plataforma a medida (web, código abierto)** | Inversión de desarrollo, pero control total, UI a medida, multi-tenant por cliente, despliegue propio en VPS | ✅ **Elegido** |
| **Monolitico con gestión externa de flujos (n8n)** | Orquestación visual cómoda, pero agrega un servicio extra, dependencia de terceros y complejidad de operación | ❌ Descartado: **backend-first** (decisiones en `architecture/decisions.md`) |
| **Hardware físico real para desarrollo** | Datos reales, pero sin acceso a los sensores del cliente | ❌ Imposible en el contexto; se usa **simulador** que emite el payload real |

## Decisiones de negocio que definieron el producto

1. **Monitoreo remoto continuo** sobre inspección física: el sistema es la "vista remota" del campo.
2. **3 datos prioritarios** (humedad del suelo, flujo/consumo, E.T.O.) tienen prominencia visual; el resto es secundario.
3. **Indicador de frescura obligatorio**: saber cuándo un nodo dejó de reportar es tan importante como el valor.
4. **Multi-tenant desde el inicio**: un Admin opera varios clientes; cada cliente ve solo lo suyo.
5. **MVP primero, Fase 2 dormida**: IA, alertas y notificaciones ya están construidas pero apagadas por defecto; el producto de hoy es ingesta + visualización + histórico + exportación.
6. **UI premium artesanal** (Bento Box orgánico, dual theme) en lugar de SCADA industrial: el productor es un usuario no técnico.

## Por qué el enfoque actual gana

- **Costo de operación**: un solo stack (FastAPI + React + MySQL) en Docker, desplegable en cualquier VPS con Dokploy.
- **Autonomía**: sin dependencias SaaS por nodo; el despliegue es reproducible (`docker compose up` + CI).
- **Evolución controlada**: las features de Fase 2 existen detrás de flags, así el cliente puede activarlas sin reescribir el producto.
- **Datos del cliente**: la BD y el API son del proyecto; exportación libre (CSV/Excel/PDF) sin candados.

## [TODO: completar]

- ¿Se evaluó alguna plataforma comercial concreta (nombre)? Añadir resultado de esa evaluación.
- Presupuesto/plazos del proyecto que condicionaron el alcance del MVP.