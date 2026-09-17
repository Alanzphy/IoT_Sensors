export type PriorityKey = "soil.humidity" | "irrigation.flow_per_minute" | "environmental.eto";
export type SemaphoreLevel = "optimal" | "warning" | "critical" | null;

export type PriorityStatusItem = {
  parameter: string;
  level: SemaphoreLevel;
};

export const defaultSemaphore: Record<PriorityKey, SemaphoreLevel> = {
  "soil.humidity": null,
  "irrigation.flow_per_minute": null,
  "environmental.eto": null,
};

// Intervalo de auto-refresco del dashboard: 30s
export const DASHBOARD_REFRESH_MS = 30000;
export const FRESH_MINUTES_THRESHOLD = 20;

export type ConnectionState = "online" | "warning" | "offline" | "no_data";
export type IrrigationDisplayState = "active" | "inactive" | "stale" | "no_data";

export function getConnectionState(lastUpdate: Date | null): ConnectionState {
  if (!lastUpdate) return "no_data";
  const minutesAgo = Math.max(0, Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60)));
  if (minutesAgo < FRESH_MINUTES_THRESHOLD) return "online";
  if (minutesAgo < 120) return "warning";
  return "offline";
}

export function getIrrigationDisplayState(
  irrigationActive: boolean | null,
  connectionState: ConnectionState,
): IrrigationDisplayState {
  if (irrigationActive === null || connectionState === "no_data") return "no_data";
  if (connectionState !== "online") return "stale";
  return irrigationActive ? "active" : "inactive";
}

export function getIrrigationStatusLabel(state: IrrigationDisplayState): string {
  if (state === "active") return "ACTIVO";
  if (state === "inactive") return "INACTIVO";
  if (state === "no_data") return "SIN DATOS";
  return "SIN COMUNICACION";
}

export function getIrrigationStatusClass(state: IrrigationDisplayState): string {
  if (state === "active") return "text-[var(--accent-primary)]";
  if (state === "stale") return "text-[var(--status-warning)]";
  return "text-[var(--text-muted)]";
}

export function getSemaphoreLabel(level: SemaphoreLevel): string {
  if (level === null) return "Sin datos de umbral";
  if (level === "critical") return "Crítico";
  if (level === "warning") return "Riesgo";
  return "Óptimo";
}

export function getSemaphoreClass(level: SemaphoreLevel): string {
  if (level === null) return "text-[var(--text-muted)]";
  if (level === "critical") return "bg-[var(--status-danger-bg)] text-[var(--status-danger)]";
  if (level === "warning") return "bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
  return "bg-[var(--status-active-bg)] text-[var(--status-active)]";
}
