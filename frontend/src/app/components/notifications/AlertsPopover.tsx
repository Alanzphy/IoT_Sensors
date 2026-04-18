import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Bell, Check, Loader2, RadioTower } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";

import { AlertItem, listAlerts, markAlertRead } from "../../services/alerts";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface AlertsPopoverProps {
  className?: string;
  refreshIntervalMs?: number;
}

const severityStyles: Record<AlertItem["severity"], string> = {
  info: "bg-[#DDE6F4] text-[#27456A]",
  warning: "bg-[#F6E4B8] text-[#6B4B14]",
  critical: "bg-[#F8D2D2] text-[#7F1D1D]",
};

const typeLabels: Record<AlertItem["type"], string> = {
  threshold: "Umbral",
  inactivity: "Inactividad",
};

function formatRelativeDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatDistanceToNowStrict(parsed, { addSuffix: true, locale: es });
}

export function AlertsPopover({
  className = "fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 group",
  refreshIntervalMs = 30000,
}: AlertsPopoverProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const visibleUnreadCount = useMemo(
    () => alerts.filter((item) => !item.read).length,
    [alerts],
  );

  const alertsPagePath = location.pathname.startsWith("/admin")
    ? "/admin/alertas"
    : "/cliente/alertas";

  const loadAlerts = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [alertsPage, unreadPage] = await Promise.all([
        listAlerts({ page: 1, per_page: 12 }),
        listAlerts({ page: 1, per_page: 1, read: false }),
      ]);

      setAlerts(alertsPage.data ?? []);
      setUnreadCount(unreadPage.total ?? 0);
    } catch (error) {
      console.error("Failed to load alerts", error);
      setErrorMessage("No fue posible cargar alertas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    const intervalId = window.setInterval(() => {
      loadAlerts();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs]);

  const handleMarkRead = async (alertId: number) => {
    setUpdatingIds((previous) => {
      const next = new Set(previous);
      next.add(alertId);
      return next;
    });

    try {
      await markAlertRead(alertId, true);
      setAlerts((previous) =>
        previous.map((item) =>
          item.id === alertId
            ? {
                ...item,
                read: true,
                read_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      setErrorMessage("No fue posible actualizar la alerta");
    } finally {
      setUpdatingIds((previous) => {
        const next = new Set(previous);
        next.delete(alertId);
        return next;
      });
    }
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[rgba(20,20,18,0.85)] backdrop-blur-xl text-[var(--accent-green)] shadow-[0_0_20px_rgba(143,175,122,0.15)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(143,175,122,0.3)] hover:border-[var(--accent-green-hover)]"
            aria-label="Abrir notificaciones"
          >
            <Bell className="h-6 w-6 transition-transform group-hover:rotate-12" />
            {unreadCount > 0 && (
              <span className="absolute 0 top-0 right-0 min-w-5 rounded-full bg-[var(--status-danger)] px-1 py-0.5 text-center text-[10px] font-bold text-white shadow-[0_0_10px_var(--status-danger)] animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          side="top"
          sideOffset={16}
          className="w-[min(92vw,430px)] rounded-[24px] border-[var(--border-glass)] glass-panel p-0 shadow-2xl"
        >
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title mb-0">Alertas del sistema</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadAlerts}
                  className="text-xs font-medium text-[var(--accent-green-dim)] hover:text-[var(--accent-green)] transition-colors"
                >
                  Actualizar
                </button>
                <Link
                  to={alertsPagePath}
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-[var(--accent-gold)] hover:text-[var(--accent-gold-hover)] transition-colors"
                >
                  Ver todas
                </Link>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)] font-mono">
              {unreadCount} no leidas · {visibleUnreadCount} visibles
            </p>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-4 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-green)]" />
                Cargando alertas...
              </div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]">
                {errorMessage}
              </div>
            ) : alerts.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Sin alertas registradas por ahora.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((item) => {
                  const isUpdating = updatingIds.has(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-xl border px-4 py-3 transition-colors duration-200 ${
                        item.read
                          ? "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] opacity-70"
                          : "border-[var(--border-highlight)] bg-[rgba(255,255,255,0.06)] shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest ${
                              item.severity === "critical"
                                ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[rgba(248,113,113,0.2)]"
                                : item.severity === "warning"
                                ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border border-[rgba(251,191,36,0.2)]"
                                : "bg-[rgba(91,155,213,0.1)] text-[#5B9BD5] border border-[rgba(91,155,213,0.2)]"
                            }`}
                          >
                            {item.severity.toUpperCase()}
                          </span>
                          <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            {typeLabels[item.type]}
                          </span>
                        </div>

                        {!item.read && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleMarkRead(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(143,175,122,0.1)] border border-[rgba(143,175,122,0.2)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent-green)] hover:bg-[rgba(143,175,122,0.2)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 uppercase tracking-wider"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Leída
                          </button>
                        )}
                      </div>

                      <p className="mb-3 text-sm text-[var(--text-primary)] font-medium leading-relaxed">{item.message}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-[var(--text-muted)] font-mono">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
                          <RadioTower className="h-3 w-3 text-[var(--accent-gold)]" />
                          Nodo {item.node_id}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">Area {item.irrigation_area_id}</span>
                        <span className="text-[10px]">{formatRelativeDate(item.timestamp)}</span>
                        {item.type === "threshold" && item.parameter && (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {item.parameter}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
