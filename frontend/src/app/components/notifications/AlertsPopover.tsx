import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Bell, Check, Loader2, RadioTower } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { usePageVisibility } from "../../hooks/usePageVisibility";
import {
    AlertItem,
    getUnreadAlertsCount,
    listAlerts,
    markAlertRead,
} from "../../services/alerts";
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
  className = "fixed top-4 right-4 md:right-6 z-40",
  // refreshIntervalMs = 30000,
  refreshIntervalMs = 3000,
}: AlertsPopoverProps) {
  const location = useLocation();
  const isPageVisible = usePageVisibility();
  const isAlertsPage = location.pathname.endsWith("/alertas");
  const loadingRef = useRef(false);
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

  const loadAlerts = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (alerts.length === 0) setLoading(true);
    setErrorMessage(null);

    try {
      const [alertsPage, unreadCountValue] = await Promise.all([
        listAlerts({ page: 1, per_page: 12 }),
        getUnreadAlertsCount(),
      ]);

      setAlerts(alertsPage.data ?? []);
      setUnreadCount(unreadCountValue);
    } catch (error) {
      console.error("Failed to load alerts", error);
      setErrorMessage("No fue posible cargar alertas");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPageVisible || isAlertsPage) return;

    loadAlerts();


  }, [refreshIntervalMs, loadAlerts, isPageVisible, isAlertsPage]);

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
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-sm transition-all hover:bg-[var(--border-subtle)]"
            aria-label="Abrir notificaciones"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                key={unreadCount}
                className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#7F1D1D] px-1.5 py-0.5 text-center text-[11px] font-semibold text-white animate-badge-pop"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[min(92vw,430px)] rounded-2xl border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0 shadow-xl"
        >
          <div className="border-b border-[var(--border-strong)] px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Alertas del sistema</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadAlerts}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:brightness-95"
                >
                  Actualizar
                </button>
                <Link
                  to={alertsPagePath}
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:opacity-80"
                >
                  Ver todas
                </Link>
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {unreadCount} no leídas · {visibleUnreadCount} visibles no leídas
            </p>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando alertas...
              </div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-[#F0C3C3] bg-[#FCE8E8] px-3 py-2 text-sm text-[#7F1D1D]">
                {errorMessage}
              </div>
            ) : alerts.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                Sin alertas registradas por ahora.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((item) => {
                  const isUpdating = updatingIds.has(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-xl border px-3 py-3 transition-colors ${
                        item.read
                          ? "border-[var(--border-strong)] bg-[var(--bg-elevated)]"
                          : "border-[var(--accent-gold)] bg-[var(--accent-gold-glow)]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityStyles[item.severity]}`}
                          >
                            {item.severity.toUpperCase()}
                          </span>
                          <span className="rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-main)]">
                            {typeLabels[item.type]}
                          </span>
                        </div>

                        {!item.read && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleMarkRead(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-main)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
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

                      <p className="mb-2 text-sm text-[var(--text-main)]">{item.message}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <RadioTower className="h-3.5 w-3.5" />
                          Nodo {item.node_id}
                        </span>
                        <span>Area {item.irrigation_area_id}</span>
                        <span>{formatRelativeDate(item.timestamp)}</span>
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
