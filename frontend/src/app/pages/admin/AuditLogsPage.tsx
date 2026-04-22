import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
    ChevronLeft,
    ChevronRight,
    FileSearch,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BentoCard } from "../../components/BentoCard";
import {
    AuditLogItem,
    getAuditLog,
    listAuditLogs,
} from "../../services/auditLogs";

const PAGE_SIZE = 20;

function formatRelativeDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatDistanceToNowStrict(parsed, { addSuffix: true, locale: es });
}

export function AuditLogsPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const normalizedItems = useMemo(
    () => items.filter((item) => Boolean(item.id)),
    [items],
  );

  const fetchAuditLogs = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listAuditLogs({
        page,
        per_page: PAGE_SIZE,
        action: action || undefined,
        entity: entity || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
      setErrorMessage("No fue posible cargar la bitacora de auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, action, entity, startDate, endDate]);

  const openLogDetail = async (logId: number) => {
    setLoadingDetail(true);
    setErrorMessage(null);

    try {
      const detail = await getAuditLog(logId);
      setSelectedLog(detail);
    } catch (error) {
      console.error("Failed to fetch audit log detail", error);
      setErrorMessage("No fue posible cargar el detalle del evento");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl text-[var(--text-main)]">Bitacora de Auditoria</h1>
          <p className="text-[var(--text-muted)]">
            Historial de cambios administrativos en la plataforma
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAuditLogs}
          className="inline-flex items-center gap-2 rounded-full border border-[#C9BEAF] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[#4A433B] hover:bg-[#EFE8DD]"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <BentoCard variant="light" className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-[#5F5549]">
            Accion
            <input
              type="text"
              value={action}
              placeholder="create, update, delete, execute"
              onChange={(event) => {
                setAction(event.target.value.trim());
                setPage(1);
              }}
              className="rounded-xl border border-[#D9D0C4] bg-white px-3 py-2 text-[var(--text-main)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[#5F5549]">
            Entidad
            <input
              type="text"
              value={entity}
              placeholder="threshold, alert, inactivity_scan"
              onChange={(event) => {
                setEntity(event.target.value.trim());
                setPage(1);
              }}
              className="rounded-xl border border-[#D9D0C4] bg-white px-3 py-2 text-[var(--text-main)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[#5F5549]">
            Desde
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#D9D0C4] bg-white px-3 py-2 text-[var(--text-main)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[#5F5549]">
            Hasta
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#D9D0C4] bg-white px-3 py-2 text-[var(--text-main)]"
            />
          </label>
        </div>
      </BentoCard>

      <BentoCard variant="light" className="overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-[#5F5549]">
            {total} eventos registrados
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={page <= 1}
              className="rounded-full border border-[#C9BEAF] bg-white p-2 text-[#4A433B] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-[#5F5549]">
              Pagina {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={page >= totalPages}
              className="rounded-full border border-[#C9BEAF] bg-white p-2 text-[#4A433B] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando bitacora...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-[#F0C3C3] bg-[#FCE8E8] px-3 py-2 text-sm text-[#7F1D1D]">
            {errorMessage}
          </div>
        ) : normalizedItems.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-strong)] bg-white px-3 py-6 text-center text-sm text-[var(--text-muted)]">
            No hay eventos para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-strong)]">
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Fecha</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Usuario</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Accion</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Entidad</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Detalle</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Ver</th>
                </tr>
              </thead>
              <tbody>
                {normalizedItems.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-[var(--bg-base)]/30" : ""}>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">
                      {formatRelativeDate(item.created_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">
                      {item.user?.full_name ?? "Sistema"}
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">{item.action}</td>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">
                      {item.entity}
                      {item.entity_id ? ` #${item.entity_id}` : ""}
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-muted)] max-w-[420px] truncate">
                      {item.detail ?? "-"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openLogDetail(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#C9BEAF] bg-white px-2 py-1 text-xs font-medium text-[#4A433B] hover:bg-[#F8F3EA]"
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--text-main)]/45 p-4">
          <BentoCard variant="light" className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl text-[var(--text-main)]">Detalle de evento #{selectedLog.id}</h2>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full border border-[#C9BEAF] bg-white px-3 py-1 text-xs font-medium text-[#4A433B] hover:bg-[#F8F3EA]"
              >
                Cerrar
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando detalle...
              </div>
            ) : (
              <div className="space-y-2 text-sm text-[var(--text-main)]">
                <p><strong>Fecha:</strong> {selectedLog.created_at}</p>
                <p><strong>Usuario:</strong> {selectedLog.user?.full_name ?? "Sistema"}</p>
                <p><strong>Email:</strong> {selectedLog.user?.email ?? "-"}</p>
                <p><strong>Accion:</strong> {selectedLog.action}</p>
                <p><strong>Entidad:</strong> {selectedLog.entity}</p>
                <p><strong>ID Entidad:</strong> {selectedLog.entity_id ?? "-"}</p>
                <p><strong>Detalle:</strong> {selectedLog.detail ?? "-"}</p>
              </div>
            )}
          </BentoCard>
        </div>
      )}
    </div>
  );
}
