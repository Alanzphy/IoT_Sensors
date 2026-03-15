import { endOfDay, format, parseISO, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { useSelection } from "../../context/SelectionContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../services/api";
import { ReadingResponse } from "../../types/api";

export function HistoricalData() {
  const { selectedArea } = useSelection();
  const isMobile = useIsMobile();

  const [dateRange, setDateRange] = useState<"Semana" | "Mes" | "Año">("Semana");
  const [category, setCategory] = useState("Todo");

  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));

  const [readings, setReadings] = useState<ReadingResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Update dates when preset changes
  useEffect(() => {
    const end = endOfDay(new Date());
    let start = startOfDay(new Date());

    if (dateRange === "Semana") start = startOfDay(subDays(new Date(), 7));
    if (dateRange === "Mes") start = startOfDay(subDays(new Date(), 30));
    if (dateRange === "Año") start = startOfDay(subDays(new Date(), 365));

    setStartDate(start);
    setEndDate(end);
    setPage(1);
  }, [dateRange]);

  // Fetch API
  useEffect(() => {
    if (!selectedArea) return;

    const fetchHistorical = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          irrigation_area_id: selectedArea.id.toString(),
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          page: page.toString(),
          per_page: "200"
        });

        // if cycle is selected, we could use it here. but backend filters by dates.

        const res = await api.get<{data: ReadingResponse[], total: number, page: number, per_page: number}>(`/readings?${params}`);
        setReadings(res.data.data);
        setTotalPages(Math.ceil(res.data.total / res.data.per_page));
        setTotalItems(res.data.total);
      } catch (err) {
        console.error("Failed to fetch historical readings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorical();
  }, [selectedArea, startDate, endDate, page]);

  // Format array for Chart (reverse since it comes desc).
  const chartData = [...readings].reverse().map(r => {
    const parsedDate = parseISO(r.timestamp + (r.timestamp.endsWith("Z") ? "" : "Z"));
    // Format based on the selected range for better visibility
    let timeString = format(parsedDate, "HH:mm", { locale: es });
    if (dateRange === "Semana") timeString = format(parsedDate, "EEE dd, HH:mm", { locale: es });
    if (dateRange === "Mes" || dateRange === "Año") timeString = format(parsedDate, "dd MMM", { locale: es });

    return {
      time: timeString,
      fullTime: parsedDate,
      soilHumidity: r.soil?.humidity ?? 0,
      waterFlow: r.irrigation?.flow_per_minute ?? 0,
      soilTemp: r.soil?.temperature ?? 0,
      airTemp: r.environmental?.temperature ?? 0,
      humidity: r.environmental?.relative_humidity ?? 0,
    };
  });

  const handleExport = async (formatType: string) => {
    if (!selectedArea) return;
    try {
      const params = new URLSearchParams({
        irrigation_area_id: selectedArea.id.toString(),
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        format: formatType
      });

      const response = await api.get(`/readings/export?${params}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = formatType === 'excel' ? 'xlsx' : formatType;
      link.setAttribute('download', `export_${selectedArea.name}_${format(new Date(), 'yyyy-MM-dd')}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Datos Históricos</h1>
        <p className="text-[#6E6359]">Consulta el histórico de lecturas de {selectedArea ? selectedArea.name : "tus sensores"}</p>
      </div>

      {/* Filters */}
      <BentoCard variant="light" className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-[#6E6359] mb-2">Rango de fechas</label>
            <div className="flex gap-2">
              {(["Semana", "Mes", "Año"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-full transition-all ${
                    dateRange === range
                      ? "bg-[#6D7E5E] text-[#F4F1EB]"
                      : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm text-[#6E6359] mb-2">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {["Todo", "Suelo", "Riego", "Ambiental"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    category === cat
                      ? "bg-[#6D7E5E] text-[#F4F1EB]"
                      : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm text-[#6E6359] mb-2">Fecha inicio</label>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] text-[#2C2621]">
              <Calendar className="w-5 h-5 text-[#6E6359]" />
              <span>{format(startDate, "dd MMM yyyy", { locale: es })}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#6E6359] mb-2">Fecha fin</label>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] text-[#2C2621]">
              <Calendar className="w-5 h-5 text-[#6E6359]" />
              <span>{format(endDate, "dd MMM yyyy", { locale: es })}</span>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* Multi-line Chart */}
      <BentoCard variant="light" className="mb-6">
        <h3 className="text-lg text-[#2C2621] mb-6">Gráfica de Métricas</h3>
        <div className="h-[400px] min-h-[400px] relative">
          {loading && (
             <div className="absolute inset-0 z-10 bg-[#FAF7F2]/50 flex items-center justify-center">
               <Loader2 className="w-8 h-8 text-[#6D7E5E] animate-spin" />
             </div>
          )}
          {readings.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" />
                <XAxis
                  dataKey="time"
                  stroke="#6E6359"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#6E6359"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#F9F8F4',
                    border: '1px solid #E6E1D8',
                    borderRadius: '16px',
                    padding: '12px'
                  }}
                  labelStyle={{ color: '#2C2621', marginBottom: '4px' }}
                />
                <Legend />
                {(category === "Todo" || category === "Suelo") && (
                  <Line type="monotone" dataKey="soilHumidity" name="Humedad suelo (%)" stroke="#6D7E5E" strokeWidth={2} dot={false} />
                )}
                {(category === "Todo" || category === "Riego") && (
                  <Line type="monotone" dataKey="waterFlow" name="Flujo agua (L/min)" stroke="#A68A61" strokeWidth={2} dot={false} />
                )}
                {(category === "Todo" || category === "Suelo") && (
                  <Line type="monotone" dataKey="soilTemp" name="Temp. suelo (°C)" stroke="#705541" strokeWidth={2} dot={false} />
                )}
                {(category === "Todo" || category === "Ambiental") && (
                  <Line type="monotone" dataKey="airTemp" name="Temp. aire (°C)" stroke="#E2D4B7" strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
             <div className="w-full h-full flex items-center justify-center text-[#6E6359]">
               {!loading && "No hay datos para el rango seleccionado"}
             </div>
          )}
        </div>
      </BentoCard>

      {/* Data Table */}
      <BentoCard variant="light">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg text-[#2C2621]">Tabla de Datos {totalPages > 0 && `(Pág ${page} de ${totalPages})`}</h3>
          <div className="flex gap-2">
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4" /> CSV
            </PillButton>
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" onClick={() => handleExport('excel')}>
              <Download className="w-4 h-4" /> Excel
            </PillButton>
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" onClick={() => handleExport('pdf')}>
              <Download className="w-4 h-4" /> PDF
            </PillButton>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-[#2C2621]/10">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Fecha/Hora</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Humedad Suelo (%)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Temp. Suelo (°C)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Flujo (L/min)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Temp. Aire (°C)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">H. Relativa (%)</th>
              </tr>
            </thead>
            <tbody className="relative">
              {!loading && readings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6E6359]">No hay registros.</td>
                </tr>
              )}
              {readings.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}>
                  <td className="py-3 px-4 text-sm text-[#2C2621]">
                    {format(parseISO(r.timestamp + (r.timestamp.endsWith("Z") ? "" : "Z")), "dd MMM yyyy, HH:mm", { locale: es })}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {r.soil?.humidity?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {r.soil?.temperature?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {r.irrigation?.flow_per_minute?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {r.environmental?.temperature?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {r.environmental?.relative_humidity?.toFixed(1) ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="px-4 py-2 rounded-full text-sm bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5] disabled:opacity-50 transition-all"
            >
              Inicio
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-full text-sm bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5] disabled:opacity-50 transition-all"
            >
              Anterior
            </button>
            <div className="px-4 text-sm text-[#6E6359] font-medium">
              Página {page} de {totalPages}
            </div>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-full text-sm bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5] disabled:opacity-50 transition-all"
            >
              Siguiente
            </button>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
