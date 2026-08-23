# Proposal: Refactor frontend consolidation (dedup)

## Problem

La auditoría encontró duplicación e inconsistencias en el frontend:

- 4 normalizadores de fecha distintos (recursivo en `api.ts`, `parseBackendTimestamp` en utils, `parseReadingTimestamp` en HistoricalData, inline `endsWith("Z")`).
- Items de navegación duplicados en `DesktopSidebar.tsx` y `MobileTabBar.tsx`, ya divergidos (móvil cliente sin "Alertas").
- Lógica de export blob/download duplicada entre `HistoricalData.tsx` y `ExportData.tsx` (una revoca el object URL, la otra no).
- `getErrorMessage` duplicado en varias páginas.
- `AdminMapPage` (807 líneas) y `ClientMapPage` (479) duplican lógica maplibre (markers, popups, bounds, leyenda).

## Goals

- 1 normalizador de fecha único.
- 1 fuente de verdad para los items de navegación (cliente/admin), con paridad móvil/desktop.
- 1 utilidad de export y 1 `getErrorMessage` compartidos.
- Lógica de mapa compartida (datos, popups, bounds, clusters) en un módulo común; las páginas quedan como wrappers delgados.

## Non-goals

- No cambiar rutas ni comportamiento visible.
- No tocar backend.

## How

- `src/app/utils/`: `datetime.ts` (normalización unificada), `errors.ts` (`getErrorMessage`), `export.ts` (descarga de blob con revoke).
- `src/app/components/navigation/items.ts`: definiciones únicas de items cliente/admin.
- `src/app/components/maps/`: hook de datos + helpers de popup/bounds/cluster compartidos por ambas páginas de mapa.

## Impact

Refactor interno sin cambio de contrato; verificado con typecheck + build.