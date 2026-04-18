import { format, startOfDay, subDays } from "date-fns";
import { Calendar, Download, FileSpreadsheet, FileText, Filter, Info } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { useSelection } from "../../context/SelectionContext";
import { api } from "../../services/api";

type ExportFmt = "csv" | "xlsx" | "pdf";

const formats: { id: ExportFmt; label: string; desc: string; icon: typeof FileText; accent: string }[] = [
  { id: "csv", label: "CSV", desc: "Ligero y rápido", icon: FileText, accent: "var(--accent-green)" },
  { id: "xlsx", label: "Excel", desc: "Análisis detallado", icon: FileSpreadsheet, accent: "#22C55E" },
  { id: "pdf", label: "PDF", desc: "Imprimible", icon: FileText, accent: "var(--accent-gold)" },
];

export function ExportData() {
  const { areas, selectedArea, setSelectedArea } = useSelection();
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(startOfDay(new Date()));
  const [exportFormat, setExportFormat] = useState<ExportFmt>("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!selectedArea) { alert("Por favor selecciona un área de riego"); return; }
    try {
      setLoading(true);
      const params = new URLSearchParams({
        irrigation_area_id: selectedArea.id.toString(),
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        format: exportFormat,
      });
      const response = await api.get(`/readings/export?${params}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
      alert("Hubo un error al exportar los datos. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="page-title text-gradient">Exportar Datos</h1>
          <p className="page-subtitle">Descarga el histórico de tus sensores en diferentes formatos</p>
        </div>

        {/* Main config card */}
        <BentoCard variant="glass" className="animate-fade-in-up space-y-6">
          {/* Date range */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4" style={{ color: "var(--accent-green)" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Rango de Fechas
              </span>
            </div>
            <ReadingDateRangeSelector
              variant="bordered"
              irrigationAreaId={selectedArea?.id}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(nextDate) => {
                const normalized = startOfDay(nextDate);
                setStartDate(normalized);
                if (normalized > endDate) setEndDate(normalized);
              }}
              onEndDateChange={(nextDate) => {
                const normalized = startOfDay(nextDate);
                setEndDate(normalized);
                if (normalized < startDate) setStartDate(normalized);
              }}
            />
          </div>

          <div className="divider" />

          {/* Area selector */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4" style={{ color: "var(--accent-green)" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Área de Riego
              </span>
            </div>
            <div className="relative">
              <select
                value={selectedArea?.id || ""}
                onChange={e => {
                  const area = areas.find(a => a.id.toString() === e.target.value);
                  if (area) setSelectedArea(area);
                }}
                className="w-full px-4 py-2.5 rounded-xl text-sm appearance-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-glass)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                {!selectedArea && <option value="" style={{ background: "var(--bg-elevated)" }}>Selecciona un área</option>}
                {areas.map(area => (
                  <option key={area.id} value={area.id} style={{ background: "var(--bg-elevated)" }}>{area.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divider" />

          {/* Format picker */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest mb-4 block" style={{ color: "var(--text-muted)" }}>
              Formato de Exportación
            </span>
            <div className="grid grid-cols-3 gap-3">
              {formats.map(fmt => {
                const Icon = fmt.icon;
                const isActive = exportFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200"
                    style={{
                      background: isActive ? `${fmt.accent}12` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isActive ? `${fmt.accent}40` : "var(--border-subtle)"}`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: isActive ? `${fmt.accent}18` : "rgba(255,255,255,0.04)" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: isActive ? fmt.accent : "var(--text-muted)" }} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm" style={{ color: isActive ? fmt.accent : "var(--text-primary)" }}>{fmt.label}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export button */}
          <div className="pt-2">
            <PillButton
              variant="primary"
              onClick={handleExport}
              disabled={loading || !selectedArea}
              className="w-full md:w-auto px-8"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Exportar Datos
                </>
              )}
            </PillButton>
          </div>
        </BentoCard>

        {/* Info card */}
        <BentoCard variant="sand" className="animate-fade-in-up">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(143,175,122,0.1)" }}>
              <Info className="w-4 h-4" style={{ color: "var(--accent-green)" }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>Información sobre exportación</h3>
              <ul className="space-y-1">
                {[
                  "El archivo incluirá todos los datos del rango seleccionado",
                  "Los datos se exportan en formato estándar UTC",
                  "Las lecturas se muestran en sus unidades originales",
                ].map(item => (
                  <li key={item} className="text-xs" style={{ color: "var(--text-muted)" }}>
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
