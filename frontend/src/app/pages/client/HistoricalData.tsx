import { differenceInCalendarDays, endOfDay, format, parseISO, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../components/BentoCard";
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
    <div className="page-wrapper overflow-x-hidden">
      <div className="mb-6 animate-fade-in">
        <h1 className="page-title text-gradient">Datos Históricos</h1>
        <p className="page-subtitle">Consulta el histórico de lecturas de {selectedArea ? selectedArea.name : "tus sensores"}</p>
      </div>

      {/* Filters */}
      <BentoCard variant="glass" className="mb-5 animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Rango de fechas</p>
            <div className="flex gap-2 flex-wrap">
              {(["Semana", "Mes", "Año"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    background: dateRange === range ? "rgba(143,175,122,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${dateRange === range ? "rgba(143,175,122,0.4)" : "var(--border-subtle)"}`,
                    color: dateRange === range ? "var(--accent-green)" : "var(--text-muted)",
                  }}
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
      <BentoCard variant="glass" className="mb-5 animate-fade-in-up">
        <h3 className="section-title mb-5">Gráfica de Métricas</h3>

        {readings.length > 0 ? (
          <div className="space-y-8">
            <div className="relative h-[320px] min-h-[320px]">
              {loading && (
                <div className="absolute inset-0 z-10 bg-[#FAF7F2]/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#6D7E5E] animate-spin" />
                </div>
              )}

              <div className="flex flex-col gap-3 mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Suelo + Ambiental</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "soilHumidity", label: "Humedad suelo", color: "var(--accent-green)" },
                    { key: "relativeHumidity", label: "H. Relativa", color: "var(--accent-gold)" },
                    { key: "soilTemp", label: "Temp. suelo", color: "#E07B54" },
                    { key: "airTemp", label: "Temp. aire", color: "#FBBF24" },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => toggleSoilEnvSeries(s.key as any)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                      style={{
                        background: soilEnvSeries[s.key as keyof typeof soilEnvSeries] ? `${s.color}18` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${soilEnvSeries[s.key as keyof typeof soilEnvSeries] ? `${s.color}40` : "var(--border-subtle)"}`,
                        color: soilEnvSeries[s.key as keyof typeof soilEnvSeries] ? s.color : "var(--text-muted)",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
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
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false} tickLine={false}
                    />
                  )}
                  {showSoilEnvTempAxis && (
                    <YAxis
                      yAxisId="temp"
                      orientation="right"
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tickFormatter={(v) => `${v}°C`}
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false} tickLine={false}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(20,20,18,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                    labelFormatter={(value) =>
                      format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                    }
                    formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                    labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px' }}
                    itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
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
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: "rgba(13,13,12,0.6)" }}>
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--accent-green)" }} />
                </div>
              )}

              <div className="flex flex-col gap-3 mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Riego + E.T.O.</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "waterFlow", label: "Flujo agua", color: "var(--accent-gold)" },
                    { key: "eto", label: "E.T.O.", color: "var(--accent-green)" },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => toggleIrrigationSeries(s.key as any)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                      style={{
                        background: irrigationSeries[s.key as keyof typeof irrigationSeries] ? `${s.color}18` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${irrigationSeries[s.key as keyof typeof irrigationSeries] ? `${s.color}40` : "var(--border-subtle)"}`,
                        color: irrigationSeries[s.key as keyof typeof irrigationSeries] ? s.color : "var(--text-muted)",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
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
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false} tickLine={false}
                    />
                  )}
                  {showIrrigationEtoAxis && (
                    <YAxis
                      yAxisId="eto"
                      orientation="right"
                      domain={[0, "dataMax + 1"]}
                      tickFormatter={(v) => `${v} mm/día`}
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false} tickLine={false}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(20,20,18,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                    labelFormatter={(value) =>
                      format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                    }
                    formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                    labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px' }}
                    itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
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
          <div className="w-full h-[120px] flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            {!loading && "No hay datos para el rango seleccionado"}
          </div>
        )}
      </BentoCard>

      {/* Data Table */}
      <BentoCard variant="glass" padding="none" className="overflow-hidden animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h3 className="section-title">Tabla de Datos {totalPages > 0 && `— Pág. ${page} de ${totalPages}`}</h3>
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] table-dark">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Humedad Suelo (%)</th>
                <th>Temp. Suelo (°C)</th>
                <th>Flujo (L/min)</th>
                <th>Temp. Aire (°C)</th>
                <th>H. Relativa (%)</th>
              </tr>
            </thead>
            <tbody>
              {!loading && readings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>No hay registros.</td>
                </tr>
              )}
              {readings.map((r) => (
                <tr key={r.id}>
                  <td className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
                    {format(parseISO(r.timestamp + (r.timestamp.endsWith("Z") ? "" : "Z")), "dd MMM yyyy, HH:mm", { locale: es })}
                  </td>
                  <td className="font-data font-medium" style={{ color: "var(--accent-green)" }}>
                    {r.soil?.humidity?.toFixed(1) ?? "—"}
                  </td>
                  <td className="font-data font-medium">
                    {r.soil?.temperature?.toFixed(1) ?? "—"}
                  </td>
                  <td className="font-data font-medium" style={{ color: "var(--accent-gold)" }}>
                    {r.irrigation?.flow_per_minute?.toFixed(1) ?? "—"}
                  </td>
                  <td className="font-data font-medium">
                    {r.environmental?.temperature?.toFixed(1) ?? "—"}
                  </td>
                  <td className="font-data font-medium">
                    {r.environmental?.relative_humidity?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-5 flex-wrap border-t" style={{ borderColor: "var(--border-subtle)" }}>
            {[{ label: "Inicio", action: () => setPage(1), disabled: page === 1 }, { label: "Anterior", action: () => setPage(p => p - 1), disabled: page === 1 }].map(btn => (
              <button
                key={btn.label}
                disabled={btn.disabled}
                onClick={btn.action}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-secondary)" }}
              >
                {btn.label}
              </button>
            ))}
            <span className="text-xs font-medium px-2" style={{ color: "var(--text-muted)" }}>
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-secondary)" }}
            >
              Siguiente
            </button>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
