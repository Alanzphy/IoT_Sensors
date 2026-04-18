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
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";

import { BentoCard } from "../../components/BentoCard";
import { AlertItem, listAlerts, markAlertRead } from "../../services/alerts";

type ReadFilter = "all" | "read" | "unread";
const PAGE_SIZE = 20;

const severityConfig: Record<AlertItem["severity"], { label: string; borderColor: string; dotClass: string }> = {
  info: { label: "INFO", borderColor: "rgba(91,155,213,0.6)", dotClass: "" },
  warning: { label: "WARNING", borderColor: "rgba(251,191,36,0.6)", dotClass: "warning" },
  critical: { label: "CRITICAL", borderColor: "rgba(248,113,113,0.7)", dotClass: "danger" },
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

function GlassSelect({ children, value, onChange }: { children: React.ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-3 py-2 text-xs appearance-none"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--border-glass)",
        color: "var(--text-primary)",
        outline: "none",
      }}
    >
      {children}
    </select>
  );
}

export function AlertsCenterPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

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
  const unreadOnPage = useMemo(() => items.filter(item => !item.read).length, [items]);

  const fetchAlerts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await listAlerts({
        page, per_page: PAGE_SIZE,
        severity: severity || undefined,
        alert_type: alertType || undefined,
        read: readFilter === "all" ? undefined : readFilter === "read" ? true : false,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch alerts", error);
      setErrorMessage("No fue posible cargar las alertas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, [page, severity, alertType, readFilter, startDate, endDate]);
  useEffect(() => {
    const id = window.setInterval(fetchAlerts, 30000);
    return () => window.clearInterval(id);
  }, [page, severity, alertType, readFilter, startDate, endDate]);

  const markAsRead = async (alertId: number) => {
    setUpdatingIds(prev => new Set(prev).add(alertId));
    try {
      await markAlertRead(alertId, true);
      setItems(prev => prev.map(item => item.id === alertId ? { ...item, read: true, read_at: new Date().toISOString() } : item));
    } catch {
      setErrorMessage("No fue posible marcar la alerta como leída");
    } finally {
      setUpdatingIds(prev => { const next = new Set(prev); next.delete(alertId); return next; });
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <h1 className="page-title text-gradient">Centro de Alertas</h1>
          <p className="page-subtitle">
            {isAdmin ? "Vista global de alertas de nodos, áreas y umbrales" : "Alertas de tus áreas de riego"}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border-glass)",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Filter bar */}
      <BentoCard variant="glass" className="mb-4 animate-fade-in-up">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Severidad</label>
            <GlassSelect value={severity} onChange={v => { setSeverity(v as any); setPage(1); }}>
              <option value="" style={{ background: "var(--bg-elevated)" }}>Todas</option>
              <option value="info" style={{ background: "var(--bg-elevated)" }}>Info</option>
              <option value="warning" style={{ background: "var(--bg-elevated)" }}>Warning</option>
              <option value="critical" style={{ background: "var(--bg-elevated)" }}>Critical</option>
            </GlassSelect>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Tipo</label>
            <GlassSelect value={alertType} onChange={v => { setAlertType(v as any); setPage(1); }}>
              <option value="" style={{ background: "var(--bg-elevated)" }}>Todos</option>
              <option value="threshold" style={{ background: "var(--bg-elevated)" }}>Umbral</option>
              <option value="inactivity" style={{ background: "var(--bg-elevated)" }}>Inactividad</option>
            </GlassSelect>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Estado</label>
            <GlassSelect value={readFilter} onChange={v => { setReadFilter(v as ReadFilter); setPage(1); }}>
              <option value="all" style={{ background: "var(--bg-elevated)" }}>Todas</option>
              <option value="unread" style={{ background: "var(--bg-elevated)" }}>No leídas</option>
              <option value="read" style={{ background: "var(--bg-elevated)" }}>Leídas</option>
            </GlassSelect>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="w-full rounded-xl px-3 py-2 text-xs"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-primary)", outline: "none" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="w-full rounded-xl px-3 py-2 text-xs"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-primary)", outline: "none" }}
            />
          </div>
        </div>
      </BentoCard>

      {/* Content card */}
      <BentoCard variant="glass" className="animate-fade-in-up">
        {/* Pagination header */}
        <div className="section-header mb-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Bell className="w-4 h-4" />
            <span>{total} alertas</span>
            {unreadOnPage > 0 && (
              <span className="badge-warning">{unreadOnPage} no leídas</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ border: "1px solid var(--border-glass)", color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ border: "1px solid var(--border-glass)", color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando alertas...</span>
          </div>
        ) : errorMessage ? (
          <div className="p-3 rounded-xl text-sm badge-danger">{errorMessage}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <Bell className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay alertas para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const isUpdating = updatingIds.has(item.id);
              const cfg = severityConfig[item.severity];
              return (
                <article
                  key={item.id}
                  className="px-4 py-3 rounded-xl transition-colors"
                  style={{
                    background: item.read ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-subtle)",
                    borderLeft: `3px solid ${cfg.borderColor}`,
                    opacity: item.read ? 0.65 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {cfg.dotClass && <span className={`status-dot ${cfg.dotClass}`} />}
                      <span
                        className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                          background: `${cfg.borderColor}20`,
                          color: cfg.borderColor,
                          border: `1px solid ${cfg.borderColor}40`,
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {typeLabels[item.type]}
                      </span>
                    </div>
                    {!item.read && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => markAsRead(item.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors disabled:opacity-50"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid var(--border-glass)",
                          color: "var(--text-muted)",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--status-active)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-glass)")}
                      >
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Leída
                      </button>
                    )}
                  </div>
                  <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>{item.message}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1">
                      <RadioTower className="w-3 h-3" /> Nodo {item.node_id}
                    </span>
                    <span>Área {item.irrigation_area_id}</span>
                    <span>{formatRelativeDate(item.timestamp)}</span>
                    {item.type === "threshold" && item.parameter && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {item.parameter}
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
  );
}
