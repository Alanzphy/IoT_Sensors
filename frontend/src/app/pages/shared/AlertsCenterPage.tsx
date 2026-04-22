import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { AlertItem, listAlerts, markAlertRead } from "../../services/alerts";

type ReadFilter = "all" | "read" | "unread";

const PAGE_SIZE = 20;

const severityStyles: Record<AlertItem["severity"], string> = {
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  critical: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
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

export function AlertsCenterPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isPageVisible = usePageVisibility();
  const loadingRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const [severity, setSeverity] = useState<"" | AlertItem["severity"]>("");
  const [alertType, setAlertType] = useState<"" | AlertItem["type"]>("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const unreadOnPage = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const fetchAlerts = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (items.length === 0) setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listAlerts({
        page,
        per_page: PAGE_SIZE,
        severity: severity || undefined,
        alert_type: alertType || undefined,
        read:
          readFilter === "all"
            ? undefined
            : readFilter === "read"
              ? true
              : false,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      setItems(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch alerts", error);
      setErrorMessage("No fue posible cargar las alertas");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page, severity, alertType, readFilter, startDate, endDate]);

  useEffect(() => {
    setItems([]);
  }, [severity, alertType, readFilter, startDate, endDate]);

  useEffect(() => {
    if (!isPageVisible) return;
    fetchAlerts();
  }, [fetchAlerts, isPageVisible]);



  const markAsRead = async (alertId: number) => {
    setUpdatingIds((previous) => {
      const next = new Set(previous);
      next.add(alertId);
      return next;
    });

    try {
      await markAlertRead(alertId, true);
      setItems((previous) =>
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
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      setErrorMessage("No fue posible marcar la alerta como leída");
    } finally {
      setUpdatingIds((previous) => {
        const next = new Set(previous);
        next.delete(alertId);
        return next;
      });
    }
  };

  const goToPreviousPage = () => {
    setPage((previous) => Math.max(1, previous - 1));
  };

  const goToNextPage = () => {
    setPage((previous) => Math.min(totalPages, previous + 1));
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">Centro de Alertas</h1>
          <p className="text-[var(--text-subtle)]">
            {isAdmin
              ? "Vista global de alertas de nodos, áreas y umbrales"
              : "Alertas de tus áreas de riego"}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAlerts}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <BentoCard variant="light" className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Severidad
            <select
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as "" | AlertItem["severity"]);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
            >
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Tipo
            <select
              value={alertType}
              onChange={(event) => {
                setAlertType(event.target.value as "" | AlertItem["type"]);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
            >
              <option value="">Todos</option>
              <option value="threshold">Umbral</option>
              <option value="inactivity">Inactividad</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Estado
            <select
              value={readFilter}
              onChange={(event) => {
                setReadFilter(event.target.value as ReadFilter);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
            >
              <option value="all">Todas</option>
              <option value="unread">No leidas</option>
              <option value="read">Leidas</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Desde
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Hasta
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
            />
          </label>
        </div>
      </BentoCard>

      <BentoCard variant="light">
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
            <Bell className="h-4 w-4" />
            {total} alertas · {unreadOnPage} no leidas en esta pagina
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={page <= 1}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-2 text-[var(--text-body)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-[var(--text-subtle)]">
              Pagina {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={page >= totalPages}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-2 text-[var(--text-body)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando alertas...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger)]">
            {errorMessage}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-6 text-center text-sm text-[var(--text-subtle)]">
            No hay alertas para los filtros seleccionados.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isUpdating = updatingIds.has(item.id);

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border px-3 py-3 transition-colors ${
                    item.read
                      ? "border-[var(--border-subtle)] bg-[var(--surface-card-primary)]"
                      : "border-[var(--status-warning)]/45 bg-[var(--status-warning-bg)]"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityStyles[item.severity]}`}
                      >
                        {item.severity.toUpperCase()}
                      </span>
                      <span className="rounded-full bg-[var(--surface-card-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-body)]">
                        {typeLabels[item.type]}
                      </span>
                    </div>

                    {!item.read && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => markAsRead(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-2 py-1 text-[11px] font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Leida
                      </button>
                    )}
                  </div>

                  <p className="mb-2 text-sm text-[var(--text-body)]">{item.message}</p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-subtle)]">
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
      </BentoCard>
    </div>
    </PageTransition>
  );
}
