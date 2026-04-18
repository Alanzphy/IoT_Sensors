import { format, startOfDay, subDays } from "date-fns";
import { Calendar, Download, FileSpreadsheet, FileText, Filter } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { useSelection } from "../../context/SelectionContext";
import { api } from "../../services/api";

export function ExportData() {
  const { areas, selectedArea, setSelectedArea } = useSelection();

  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(startOfDay(new Date()));
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!selectedArea) {
      alert("Por favor selecciona un área de riego");
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
      const extension = exportFormat;
      link.setAttribute("download", `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${extension}`);
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
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">
            Exportar Datos
          </h1>
          <p className="text-[#6B5E4C]">
            Descarga el histórico de tus sensores en diferentes formatos
          </p>
        </div>

        {/* Export Configuration */}
        <BentoCard className="p-6">
          <div className="space-y-6">
            {/* Date Range */}
            <div>
              <label className="flex items-center gap-2 text-[#2C2621] mb-3">
                <Calendar className="w-5 h-5 text-[#7C8F5C]" />
                <span className="font-medium">Rango de Fechas</span>
              </label>
              <ReadingDateRangeSelector
                variant="bordered"
                irrigationAreaId={selectedArea?.id}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={(nextDate) => {
                  const normalized = startOfDay(nextDate);
                  setStartDate(normalized);
                  if (normalized > endDate) {
                    setEndDate(normalized);
                  }
                }}
                onEndDateChange={(nextDate) => {
                  const normalized = startOfDay(nextDate);
                  setEndDate(normalized);
                  if (normalized < startDate) {
                    setStartDate(normalized);
                  }
                }}
              />
            </div>

            {/* Area Selection */}
            <div>
              <label className="flex items-center gap-2 text-[#2C2621] mb-3">
                <Filter className="w-5 h-5 text-[#7C8F5C]" />
                <span className="font-medium">Filtros</span>
              </label>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#6B5E4C] mb-2">
                    Área de Riego
                  </label>
                  <select
                    value={selectedArea?.id || ""}
                    onChange={(e) => {
                      const area = areas.find(a => a.id.toString() === e.target.value);
                      if (area) setSelectedArea(area);
                    }}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C]"
                  >
                    {!selectedArea && <option value="">Selecciona un área</option>}
                    {areas.map(area => (
                       <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-[#2C2621] mb-3 font-medium">
                Formato de Exportación
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    exportFormat === "csv"
                      ? "border-[#7C8F5C] bg-[#7C8F5C]/10"
                      : "border-[#E5DDD1] bg-white hover:border-[#7C8F5C]/50"
                  }`}
                >
                  <div className="text-center flex flex-col items-center">
                    <div className="mb-2"><FileText className="w-8 h-8 text-[#2C2621]" /></div>
                    <div className="font-medium text-[#2C2621]">CSV</div>
                    <div className="text-xs text-[#6B5E4C]">Ligero y rápido</div>
                  </div>
                </button>

                <button
                  onClick={() => setExportFormat("xlsx")}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    exportFormat === "xlsx"
                      ? "border-[#7C8F5C] bg-[#7C8F5C]/10"
                      : "border-[#E5DDD1] bg-white hover:border-[#7C8F5C]/50"
                  }`}
                >
                  <div className="text-center flex flex-col items-center">
                    <div className="mb-2"><FileSpreadsheet className="w-8 h-8 text-[#2C2621]" /></div>
                    <div className="font-medium text-[#2C2621]">Excel</div>
                    <div className="text-xs text-[#6B5E4C]">Análisis detallado</div>
                  </div>
                </button>

                <button
                  onClick={() => setExportFormat("pdf")}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    exportFormat === "pdf"
                      ? "border-[#7C8F5C] bg-[#7C8F5C]/10"
                      : "border-[#E5DDD1] bg-white hover:border-[#7C8F5C]/50"
                  }`}
                >
                  <div className="text-center flex flex-col items-center">
                    <div className="mb-2"><FileText className="w-8 h-8 text-[#2C2621]" /></div>
                    <div className="font-medium text-[#2C2621]">PDF</div>
                    <div className="text-xs text-[#6B5E4C]">Imprimible</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-4">
              <PillButton
                variant="primary"
                onClick={handleExport}
                className="w-full md:w-auto px-8"
                disabled={loading || !selectedArea}
              >
                {loading ? "Generando..." : (
                  <>
                    <Download className="w-4 h-4 mr-2 inline" />
                    Exportar Datos
                  </>
                )}
              </PillButton>
            </div>
          </div>
        </BentoCard>

        {/* Info Card */}
        <BentoCard className="p-6 bg-[#7C8F5C]/10 border-2 border-[#7C8F5C]/20">
          <h3 className="text-lg text-[#2C2621] mb-2">
            📌 Información sobre exportación
          </h3>
          <ul className="space-y-1 text-sm text-[#6B5E4C]">
            <li>• El archivo incluirá todos los datos del rango seleccionado</li>
            <li>• Los datos se exportan en formato estándar UTC</li>
            <li>• Las lecturas se muestran en sus unidades originales</li>
          </ul>
        </BentoCard>
      </div>
    </div>
  );
}
