import { format, startOfDay, subDays } from "date-fns";
import { Calendar, Download, FileSpreadsheet, FileText, Filter } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { useToast } from "../../components/Toast";
import { useSelection } from "../../context/SelectionContext";
import { api } from "../../services/api";

export function ExportData() {
  const { areas, selectedArea, setSelectedArea } = useSelection();
  const { showToast } = useToast();

  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(startOfDay(new Date()));
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!selectedArea) {
      showToast("Por favor selecciona un área de riego.", "error");
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        irrigation_area_id: selectedArea.id.toString(),
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        format: exportFormat
      });

      const response = await api.get(`/readings/export?${params}`, {
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Exportación completada correctamente.", "success");
    } catch (err) {
      console.error("Export failed", err);
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
            <h1 className="text-2xl md:text-3xl font-serif text-[#2C2621] mb-2">
              Exportar Datos
            </h1>
            <p className="text-[#6E6359]">
              Descarga el histórico de tus sensores en diferentes formatos
            </p>
          </div>

          {/* Export Configuration */}
          <BentoCard>
            <div className="space-y-6">
              {/* Date Range */}
              <div>
                <label className="flex items-center gap-2 text-[#2C2621] mb-3">
                  <Calendar className="w-5 h-5 text-[#6D7E5E]" />
                  <span className="font-medium">Rango de Fechas</span>
                </label>
                <ReadingDateRangeSelector
                  variant="soft"
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

              {/* Area Selection */}
              <div>
                <label htmlFor="export-area" className="flex items-center gap-2 text-[#2C2621] mb-3">
                  <Filter className="w-5 h-5 text-[#6D7E5E]" />
                  <span className="font-medium">Área de Riego</span>
                </label>
                <select
                  id="export-area"
                  value={selectedArea?.id || ""}
                  onChange={(e) => {
                    const area = areas.find(a => a.id.toString() === e.target.value);
                    if (area) setSelectedArea(area);
                  }}
                  className="w-full px-4 py-2.5 bg-[#F4F1EB] border border-[#2C2621]/10 rounded-[24px] text-[#2C2621]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-1 transition-shadow"
                >
                  {!selectedArea && <option value="">Selecciona un área</option>}
                  {areas.map(area => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>

              {/* Format Selection */}
              <div>
                <p className="text-[#2C2621] mb-3 font-medium">Formato de Exportación</p>
                <div className="grid grid-cols-3 gap-3">
                  {formatOptions.map(({ id, icon: Icon, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => setExportFormat(id)}
                      className={`p-4 rounded-[24px] border-2 transition-all active:scale-[0.97]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E]
                        ${exportFormat === id
                          ? "border-[#6D7E5E] bg-[#6D7E5E]/8"
                          : "border-[#2C2621]/10 bg-[#F4F1EB] hover:border-[#6D7E5E]/40"
                        }`}
                      aria-pressed={exportFormat === id}
                    >
                      <div className="text-center flex flex-col items-center gap-1">
                        <Icon className={`w-7 h-7 ${exportFormat === id ? "text-[#6D7E5E]" : "text-[#6E6359]"}`} />
                        <div className="font-medium text-[#2C2621] text-sm">{label}</div>
                        <div className="text-xs text-[#6E6359]">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

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
          <BentoCard className="bg-[#6D7E5E]/6 border border-[#6D7E5E]/15">
            <h3 className="text-[#2C2621] font-medium mb-2 flex items-center gap-2">
              <span>📌</span> Información sobre exportación
            </h3>
            <ul className="space-y-1 text-sm text-[#6E6359]">
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
