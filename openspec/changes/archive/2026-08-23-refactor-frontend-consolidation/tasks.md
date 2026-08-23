# Tasks

## 1. Fechas unificadas

- [ ] `src/app/utils/datetime.ts`: una sola función de normalización (parse + `Z` a naive backend).
- [ ] Reemplazar `parseBackendTimestamp`, `parseReadingTimestamp` (HistoricalData), inline `endsWith("Z")` y el recursivo de `api.ts` por el helper único. Mantener compatibilidad con el campo `available_dates` (fechas sin hora).

## 2. Navegación

- [ ] `src/app/components/navigation/items.ts`: items únicos para cliente y admin (con rutas, iconos, etiquetas).
- [ ] `DesktopSidebar.tsx` y `MobileTabBar.tsx` consumen items.ts (paridad: móvil cliente DEBE incluir "Alertas" igual que desktop).

## 3. Utils compartidos

- [ ] `src/app/utils/errors.ts`: `getErrorMessage(error, fallback)` usado por NodeManagement/NodeDetail y demás páginas que lo dupliquen.
- [ ] `src/app/utils/export.ts`: descarga de blob (con `revokeObjectURL`) usada por HistoricalData y ExportData.

## 4. Mapas

- [ ] `src/app/components/maps/`: extraer de AdminMapPage/ClientMapPage la lógica común: fetch de `/nodes/geo`, construcción de popups HTML, cálculo de bounds, config de clusters/capas por frescura.
- [ ] Ambas páginas usan el módulo compartido (sin cambio visual).

## 5. Verify

- [ ] `npm run typecheck` y `npm run build` en verde.
- [ ] Archivar cambio con `--skip-specs` (refactor puro).