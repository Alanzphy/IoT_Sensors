import { format } from "date-fns";
import { Calendar, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { SelectionScopeBar } from "../../components/selection/SelectionScopeBar";
import { useToast } from "../../components/Toast";
import { useSelection } from "../../context/SelectionContext";
import { downloadBlobExport } from "../../utils/export";
import { useReadingFilters } from "../../services/useReadingFilters";
import { readingQuery } from "../../utils/readingFilters";

export function ExportData() {
  const { selectedArea } = useSelection();
  return <AreaExport key={selectedArea?.id ?? "none"} />;
}

function AreaExport() {
  const { selectedArea } = useSelection();
  const { showToast } = useToast();

  const filters = useReadingFilters();
  const { startDate, endDate, cycleId } = filters;
  const [error, setError] = useState<string>();
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;
    if (!selectedArea) {
      showToast("Por favor selecciona un área de riego.", "error");
      return;
    }

    try {
      setLoading(true);
      setError(undefined);
      const params = readingQuery(selectedArea.id, startDate, endDate, cycleId);
      params.set("format", exportFormat);

      const fileName = `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${exportFormat}`;
      await downloadBlobExport(`/readings/export?${params}`, fileName);
      showToast("Exportación completada correctamente.", "success");
    } catch (err) {
      setError("No se pudo exportar. Intenta nuevamente.");
      showToast("Hubo un error al exportar los datos. Intenta nuevamente.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatOptions = [
    { id: "csv" as const,  icon: FileText,        label: "CSV",   desc: "Ligero y rápido" },
    { id: "xlsx" as const, icon: FileSpreadsheet,  label: "Excel", desc: "Análisis detallado" },
    { id: "pdf" as const,  icon: FileText,         label: "PDF",   desc: "Imprimible" },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">
              Exportar Datos
            </h1>
            <p className="text-[var(--text-subtle)]">
              Descarga el histórico de tus sensores en diferentes formatos
            </p>
          </div>
          <SelectionScopeBar className="mb-1" />

          {/* Export Configuration */}
          <BentoCard>
            <div className="space-y-6">
              {/* Date Range */}
              <div>
                <label className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                  <Calendar className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Rango de Fechas</span>
                </label>
                <ReadingDateRangeSelector
                  variant="soft"
                  irrigationAreaId={selectedArea?.id}
                  {...filters}
                />
              </div>

              {/* Format Selection */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">Formato de Exportación</p>
                <div className="grid grid-cols-3 gap-3">
                  {formatOptions.map(({ id, icon: Icon, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => setExportFormat(id)}
                      className={`p-4 rounded-[24px] border-2 transition-all active:scale-[0.97]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
                        ${exportFormat === id
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/8"
                          : "border-[var(--border-subtle)] bg-[var(--surface-card-primary)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--hover-overlay)]"
                        }`}
                      aria-pressed={exportFormat === id}
                    >
                      <div className="text-center flex flex-col items-center gap-1">
                        <Icon className={`w-7 h-7 ${exportFormat === id ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`} />
                        <div className="font-medium text-[var(--text-body)] text-sm">{label}</div>
                        <div className="text-xs text-[var(--text-subtle)]">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p role="alert">{error}</p>}
              {!selectedArea && <p role="status">Selecciona un área de riego para exportar.</p>}
              {/* Export Button */}
              <div className="pt-2">
                <PillButton
                  variant="primary"
                  onClick={handleExport}
                  className="w-full md:w-auto px-10"
                  disabled={loading || !selectedArea}
                  loading={loading}
                >
                  <Download className="w-4 h-4" />
                  {loading ? "Generando archivo..." : "Exportar Datos"}
                </PillButton>
              </div>
            </div>
          </BentoCard>

          {/* Info Card */}
          <BentoCard className="bg-[var(--status-info-bg)] border border-[var(--status-info)]/20">
            <h3 className="text-[var(--text-body)] font-medium mb-2 flex items-center gap-2">
              <span>📌</span> Información sobre exportación
            </h3>
            <ul className="space-y-1 text-sm text-[var(--text-subtle)]">
              <li>• El archivo incluirá todos los datos del rango seleccionado</li>
              <li>• Los datos se exportan en formato estándar UTC</li>
              <li>• Las lecturas se muestran en sus unidades originales</li>
            </ul>
          </BentoCard>
        </div>
      </div>
    </PageTransition>
  );
}
