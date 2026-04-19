import { differenceInCalendarDays, endOfDay, format, parseISO, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../components/BentoCard";
import { ChartSkeleton } from "../../components/ChartSkeleton";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { useSelection } from "../../context/SelectionContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../services/api";
import { ReadingResponse } from "../../types/api";

export function HistoricalData() {
  const { selectedArea } = useSelection();
  const isMobile = useIsMobile();

  const [dateRange, setDateRange] = useState<"Semana" | "Mes" | "Año" | "Personalizado">("Semana");

  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));

  const [readings, setReadings] = useState<ReadingResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [soilEnvSeries, setSoilEnvSeries] = useState({
    soilHumidity: true,
    relativeHumidity: true,
    soilTemp: true,
    airTemp: true,
  });

  const [irrigationSeries, setIrrigationSeries] = useState({
    waterFlow: true,
    eto: true,
  });

  // Update dates when preset changes
  useEffect(() => {
    if (dateRange === "Personalizado") return;

    const end = endOfDay(new Date());
    let start = startOfDay(new Date());

    if (dateRange === "Semana") start = startOfDay(subDays(new Date(), 7));
    if (dateRange === "Mes") start = startOfDay(subDays(new Date(), 30));
    if (dateRange === "Año") start = startOfDay(subDays(new Date(), 365));

    setStartDate(start);
    setEndDate(end);
    setPage(1);
  }, [dateRange]);

  const handleStartDateChange = (date: Date) => {
    const nextStart = startOfDay(date);
    setDateRange("Personalizado");
    setStartDate(nextStart);
    if (nextStart > endDate) {
      setEndDate(endOfDay(nextStart));
    }
    setPage(1);
  };

  const handleEndDateChange = (date: Date) => {
    const nextEnd = endOfDay(date);
    setDateRange("Personalizado");
    setEndDate(nextEnd);
    if (nextEnd < startDate) {
      setStartDate(startOfDay(nextEnd));
    }
    setPage(1);
  };

  // Fetch API
  useEffect(() => {
    if (!selectedArea) return;

    const fetchHistorical = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          irrigation_area_id: selectedArea.id.toString(),
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          page: page.toString(),
          per_page: "20"
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

    return {
      timestampMs: parsedDate.getTime(),
      soilHumidity: r.soil?.humidity ?? 0,
      waterFlow: r.irrigation?.flow_per_minute ?? 0,
      soilTemp: r.soil?.temperature ?? 0,
      airTemp: r.environmental?.temperature ?? 0,
      relativeHumidity: r.environmental?.relative_humidity ?? 0,
      eto: r.environmental?.eto ?? 0,
    };
  });

  const daySpan = Math.max(1, differenceInCalendarDays(endDate, startDate));

  const getXAxisTickLabel = (value: number) => {
    const date = new Date(value);

    if (daySpan <= 1) return format(date, "HH:mm", { locale: es });
    if (daySpan <= 31) return format(date, "dd MMM", { locale: es });
    return format(date, "dd MMM yy", { locale: es });
  };

  const getLineValueFormatter = (value: number, lineName: string) => {
    if (lineName.includes("(%)")) return [`${value.toFixed(1)} %`, lineName] as const;
    if (lineName.includes("(°C)")) return [`${value.toFixed(1)} °C`, lineName] as const;
    if (lineName.includes("(L/min)")) return [`${value.toFixed(1)} L/min`, lineName] as const;
    if (lineName.includes("(mm/día)")) return [`${value.toFixed(2)} mm/día`, lineName] as const;
    return [value.toFixed(1), lineName] as const;
  };

  const toggleSoilEnvSeries = (key: keyof typeof soilEnvSeries) => {
    setSoilEnvSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleIrrigationSeries = (key: keyof typeof irrigationSeries) => {
    setIrrigationSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showSoilEnvPercentAxis = soilEnvSeries.soilHumidity || soilEnvSeries.relativeHumidity;
  const showSoilEnvTempAxis = soilEnvSeries.soilTemp || soilEnvSeries.airTemp;
  const showIrrigationFlowAxis = irrigationSeries.waterFlow;
  const showIrrigationEtoAxis = irrigationSeries.eto;

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
      const extension = formatType;
      link.setAttribute('download', `export_${selectedArea.name}_${format(new Date(), 'yyyy-MM-dd')}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-serif text-[#2C2621] mb-2">Datos Históricos</h1>
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
        </div>

        {/* Date pickers */}
        <div className="mt-4">
          <ReadingDateRangeSelector
            variant="soft"
            irrigationAreaId={selectedArea?.id}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />
        </div>
      </BentoCard>

      {/* Multi-line Chart */}
      <BentoCard variant="light" className="mb-6">
        <h3 className="text-lg text-[#2C2621] mb-6">Gráfica de Métricas</h3>

        {loading && readings.length === 0 ? (
          <ChartSkeleton title={false} height="sm" />
        ) : readings.length > 0 ? (
          <div className="space-y-8">
            <div className="relative h-[320px] min-h-[320px]">
              {loading && (
                <div className="absolute inset-0 z-10 bg-[#FAF7F2]/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#6D7E5E] animate-spin" />
                </div>
              )}

              <div className="flex flex-col gap-3 mb-2">
                <h4 className="text-sm md:text-base text-[#2C2621]">Suelo + Ambiental (Temperaturas y Humedades)</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleSoilEnvSeries("soilHumidity")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.soilHumidity
                        ? "bg-[#6D7E5E] text-[#F4F1EB]"
                        : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                    }`}
                  >
                    Humedad suelo
                  </button>
                  <button
                    onClick={() => toggleSoilEnvSeries("relativeHumidity")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.relativeHumidity
                        ? "bg-[#A68A61] text-[#F4F1EB]"
                        : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                    }`}
                  >
                    H. Relativa
                  </button>
                  <button
                    onClick={() => toggleSoilEnvSeries("soilTemp")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.soilTemp
                        ? "bg-[#705541] text-[#F4F1EB]"
                        : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                    }`}
                  >
                    Temp. suelo
                  </button>
                  <button
                    onClick={() => toggleSoilEnvSeries("airTemp")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.airTemp
                        ? "bg-[#C8AE85] text-[#2C2621]"
                        : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                    }`}
                  >
                    Temp. aire
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" />
                  <XAxis
                    dataKey="timestampMs"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={getXAxisTickLabel}
                    minTickGap={isMobile ? 36 : 24}
                    stroke="#6E6359"
                    style={{ fontSize: '12px' }}
                  />
                  {showSoilEnvPercentAxis && (
                    <YAxis
                      yAxisId="percent"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      stroke="#6E6359"
                      style={{ fontSize: '12px' }}
                    />
                  )}
                  {showSoilEnvTempAxis && (
                    <YAxis
                      yAxisId="temp"
                      orientation="right"
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tickFormatter={(v) => `${v}°C`}
                      stroke="#705541"
                      style={{ fontSize: '12px' }}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#F9F8F4',
                      border: '1px solid #E6E1D8',
                      borderRadius: '16px',
                      padding: '12px'
                    }}
                    labelFormatter={(value) =>
                      format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                    }
                    formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                    labelStyle={{ color: '#2C2621', marginBottom: '4px' }}
                  />
                  <Legend />
                  {soilEnvSeries.soilHumidity && (
                    <Line yAxisId="percent" type="monotone" dataKey="soilHumidity" name="Humedad suelo (%)" stroke="#6D7E5E" strokeWidth={2.5} dot={false} />
                  )}
                  {soilEnvSeries.relativeHumidity && (
                    <Line yAxisId="percent" type="monotone" dataKey="relativeHumidity" name="H. Relativa (%)" stroke="#A68A61" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                  {soilEnvSeries.soilTemp && (
                    <Line yAxisId="temp" type="monotone" dataKey="soilTemp" name="Temp. suelo (°C)" stroke="#705541" strokeWidth={2.2} dot={false} />
                  )}
                  {soilEnvSeries.airTemp && (
                    <Line yAxisId="temp" type="monotone" dataKey="airTemp" name="Temp. aire (°C)" stroke="#C8AE85" strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="relative h-[280px] min-h-[280px]">
              {loading && (
                <div className="absolute inset-0 z-10 bg-[#FAF7F2]/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#6D7E5E] animate-spin" />
                </div>
              )}

              <div className="flex flex-col gap-3 mb-2">
                <h4 className="text-sm md:text-base text-[#2C2621]">Riego + E.T.O.</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleIrrigationSeries("waterFlow")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      irrigationSeries.waterFlow
                        ? "bg-[#A68A61] text-[#F4F1EB]"
                        : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                    }`}
                  >
                    Flujo agua
                  </button>
                  <button
                    onClick={() => toggleIrrigationSeries("eto")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      irrigationSeries.eto
                        ? "bg-[#6D7E5E] text-[#F4F1EB]"
                        : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                    }`}
                  >
                    E.T.O.
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" />
                  <XAxis
                    dataKey="timestampMs"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={getXAxisTickLabel}
                    minTickGap={isMobile ? 36 : 24}
                    stroke="#6E6359"
                    style={{ fontSize: '12px' }}
                  />
                  {showIrrigationFlowAxis && (
                    <YAxis
                      yAxisId="flow"
                      domain={[0, "dataMax + 2"]}
                      tickFormatter={(v) => `${v} L/min`}
                      stroke="#A68A61"
                      style={{ fontSize: '12px' }}
                    />
                  )}
                  {showIrrigationEtoAxis && (
                    <YAxis
                      yAxisId="eto"
                      orientation="right"
                      domain={[0, "dataMax + 1"]}
                      tickFormatter={(v) => `${v} mm/día`}
                      stroke="#6D7E5E"
                      style={{ fontSize: '12px' }}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#F9F8F4',
                      border: '1px solid #E6E1D8',
                      borderRadius: '16px',
                      padding: '12px'
                    }}
                    labelFormatter={(value) =>
                      format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                    }
                    formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                    labelStyle={{ color: '#2C2621', marginBottom: '4px' }}
                  />
                  <Legend />
                  {irrigationSeries.waterFlow && (
                    <Line yAxisId="flow" type="monotone" dataKey="waterFlow" name="Flujo agua (L/min)" stroke="#A68A61" strokeWidth={2.5} dot={false} />
                  )}
                  {irrigationSeries.eto && (
                    <Line yAxisId="eto" type="monotone" dataKey="eto" name="E.T.O. (mm/día)" stroke="#6D7E5E" strokeWidth={2.2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="w-full h-[120px] flex items-center justify-center text-[#6E6359]">
            {!loading && "No hay datos para el rango seleccionado"}
          </div>
        )}
      </BentoCard>

      {/* Data Table */}
      <BentoCard variant="light">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg text-[#2C2621]">
            Tabla de Datos{" "}
            <span className="text-sm text-[#6E6359] font-normal">
              {totalItems > 0 && `${totalItems} registros — pág. ${page} de ${totalPages}`}
            </span>
          </h3>
          <div className="flex gap-2">
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4" /> CSV
            </PillButton>
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" onClick={() => handleExport('xlsx')}>
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
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Fecha/Hora</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Humedad Suelo (%)</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Temp. Suelo (°C)</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Flujo (L/min)</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Temp. Aire (°C)</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">H. Relativa (%)</th>
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
    </PageTransition>
  );
}
