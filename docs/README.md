# Documentación — Guía General

Este repositorio organiza la información en **tres capas** con responsabilidades estrictas:

```
docs/product/     El "por qué" — contexto de negocio, visión, problema, requerimientos de alto nivel
openspec/specs/   El "qué" — comportamiento del sistema (requirements + scenarios por capacidad)
docs/             El "cómo" — referencia técnica (arquitectura, stack, API, datos, seguridad, deploy)
```

## 1. Capa de Producto — `docs/product/`

Fuente de verdad del contexto de negocio. **Empieza aquí si eres nuevo** o si quieres entender para qué existe el sistema.

| Archivo | Contenido |
|---|---|
| `product/README.md` | Índice de la capa y cómo se relaciona con el resto |
| `product/vision.md` | Visión, problema que resuelve, para quién |
| `product/problem-context.md` | Situación actual, dolores, impacto |
| `product/high-level-requirements.md` | Requerimientos de negocio (no técnicos) y fuera de alcance |
| `product/solution-exploration.md` | Alternativas consideradas y por qué el enfoque actual |

## 2. OpenSpec — `openspec/specs/`

Comportamiento del sistema, por capacidad. Todo cambio de comportamiento parte de un cambio en `openspec/changes/` (proposal → delta specs → design → tasks) y se archiva sincronizando las specs.

| Capacidad | Qué especifica |
|---|---|
| `readings` | Ingesta de lecturas + consulta, histórico, export, frescura, prioridad |
| `security` | Auth (JWT + API keys), roles, ownership, hardening |
| `data-model` | Jerarquía Cliente→Predio→Área→Nodo, lecturas wide table, ciclos, catálogos |
| `alerting` | Umbrales, alertas, inactividad, notificaciones (Fase 2, dormido) |
| `ai-modules` | Asistente IA, reportes, uso (Fase 2, dormido) |
| `geo-visualization` | Mapas cliente/admin (MapLibre), estado por frescura |

## 3. Referencia técnica — `docs/`

| Archivo | Contenido |
|---|---|
| `architecture/overview.md` | Diagramas de infraestructura, flujos de datos, autenticación |
| `architecture/frontend.md` | Stack, estructura, módulos y navegación del frontend |
| `architecture/backend.md` | Estructura del backend, convenciones, capas, jobs |
| `architecture/decisions.md` | ADRs: decisiones técnicas y sus consecuencias |
| `stack.md` | Resumen del stack y versiones clave |
| `api.md` | Guía rápida de la API (convenciones, auth, tabla de recursos) — contrato completo en `openapi.yaml` (raíz, autogenerado) |
| `data-model.md` | Modelo de datos: tablas, relaciones, ERD, consultas de referencia |
| `security.md` | Mecanismos de seguridad y pendientes |
| `design-system.md` | Design system del frontend (tokens reales) |
| `deployment.md` | Despliegue en Dokploy |
| `operations.md` | Operación: demo reproducible, simulador, schedulers, scripts |
| `testing.md` | Estrategia de testing (pytest, vitest) + CI + pendientes |
| `deliverables/` | Entregables al cliente (SRS, Reporte QA, Entregable Word) — congelados |

## Cómo usarlo (IA o desarrollador nuevo)

1. **Entender el producto**: `docs/product/README.md` → `vision.md` → `problem-context.md`.
2. **Entender el comportamiento**: `openspec/specs/` (requisitos + escenarios por capacidad).
3. **Entender la construcción**: `docs/stack.md` → `docs/architecture/overview.md` → `docs/architecture/backend.md` o `frontend.md`.
4. **Antes de tocar un endpoint o una tabla**: `docs/api.md` + `openapi.yaml`, y `docs/data-model.md`.
5. **Para cambiar el comportamiento**: crear un cambio OpenSpec (los specs son la fuente de verdad del "qué").
6. **El contrato técnico**: `openapi.yaml` se regenera con `make openapi-sync` desde el backend activo.

> Contexto del agente: `AGENTS.md` (raíz) contiene las reglas y restricciones de desarrollo; `docs/test-data.md` las credenciales de prueba.