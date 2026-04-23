import { differenceInCalendarDays, endOfDay, format, parseISO, startOfDay, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type QuickDateRange = "Hoy" | "Últimos 7 días" | "Últimos 30 días" | "Este mes";
type DateRangeMode = QuickDateRange | "Personalizado";

const DEFAULT_QUICK_RANGE: QuickDateRange = "Últimos 7 días";
const MAX_CHART_POINTS = 450;
const MS_IN_MINUTE = 60 * 1000;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;
const BUCKET_OPTIONS_MS = [
  30 * MS_IN_MINUTE,
  1 * MS_IN_HOUR,
  2 * MS_IN_HOUR,
  3 * MS_IN_HOUR,
  6 * MS_IN_HOUR,
  12 * MS_IN_HOUR,
  1 * MS_IN_DAY,
  2 * MS_IN_DAY,
  7 * MS_IN_DAY,
];

type HistoricalChartPoint = {
  timestampMs: number;
  soilHumidity: number;
  waterFlow: number;
  soilTemp: number;
  airTemp: number;
  relativeHumidity: number;
  eto: number;
};

type ChartAggregationResult = {
  bucketMs: number;
  points: HistoricalChartPoint[];
};

function getBaseBucketMs(daySpan: number): number {
  if (daySpan <= 7) return 30 * MS_IN_MINUTE;
  if (daySpan <= 30) return 2 * MS_IN_HOUR;
  if (daySpan <= 90) return 6 * MS_IN_HOUR;
  if (daySpan <= 365) return 1 * MS_IN_DAY;
  return 2 * MS_IN_DAY;
}

function chooseBucketMs(daySpan: number, rangeMs: number): number {
  const baseBucketMs = getBaseBucketMs(daySpan);
  const requiredBucketMs = Math.max(1, Math.ceil(rangeMs / MAX_CHART_POINTS));
  const desiredBucketMs = Math.max(baseBucketMs, requiredBucketMs);

  for (const option of BUCKET_OPTIONS_MS) {
    if (option >= desiredBucketMs) {
      return option;
    }
  }

  return desiredBucketMs;
}

function parseReadingTimestamp(value: string): Date {
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return parseISO(value + (value.endsWith("Z") ? "" : "Z"));
}

function aggregateReadingsForChart(
  readings: ReadingResponse[],
  rangeStart: Date,
  rangeEnd: Date,
): ChartAggregationResult {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const daySpan = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const rangeMs = Math.max(1, endMs - startMs + 1);
  const bucketMs = chooseBucketMs(daySpan, rangeMs);

  const buckets = new Map<number, {
    count: number;
    soilHumidity: number;
    waterFlow: number;
    soilTemp: number;
    airTemp: number;
    relativeHumidity: number;
    eto: number;
  }>();

  for (const reading of readings) {
    const parsedDate = parseReadingTimestamp(reading.timestamp);
    const readingMs = parsedDate.getTime();

    if (!Number.isFinite(readingMs) || readingMs < startMs || readingMs > endMs) {
      continue;
    }

    const bucketIndex = Math.floor((readingMs - startMs) / bucketMs);
    const bucketStartMs = startMs + (bucketIndex * bucketMs);
    const current = buckets.get(bucketStartMs) ?? {
      count: 0,
      soilHumidity: 0,
      waterFlow: 0,
      soilTemp: 0,
      airTemp: 0,
      relativeHumidity: 0,
      eto: 0,
    };

    current.count += 1;
    current.soilHumidity += reading.soil?.humidity ?? 0;
    current.waterFlow += reading.irrigation?.flow_per_minute ?? 0;
    current.soilTemp += reading.soil?.temperature ?? 0;
    current.airTemp += reading.environmental?.temperature ?? 0;
    current.relativeHumidity += reading.environmental?.relative_humidity ?? 0;
    current.eto += reading.environmental?.eto ?? 0;

    buckets.set(bucketStartMs, current);
  }

  const points = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestampMs, bucket]) => ({
      timestampMs,
      soilHumidity: bucket.soilHumidity / bucket.count,
      waterFlow: bucket.waterFlow / bucket.count,
      soilTemp: bucket.soilTemp / bucket.count,
      airTemp: bucket.airTemp / bucket.count,
      relativeHumidity: bucket.relativeHumidity / bucket.count,
      eto: bucket.eto / bucket.count,
    }));

  if (points.length <= MAX_CHART_POINTS) {
    return { bucketMs, points };
  }

  const step = Math.ceil(points.length / MAX_CHART_POINTS);
  return {
    bucketMs,
    points: points.filter((_, index) => index % step === 0 || index === points.length - 1),
  };
}

function getQuickRangeDates(range: QuickDateRange) {
  const now = new Date();

  if (range === "Hoy") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (range === "Últimos 30 días") {
    return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }

  if (range === "Este mes") {
    return { start: startOfMonth(now), end: endOfDay(now) };
  }

  return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
}

export function HistoricalData() {
  const { selectedArea } = useSelection();
  const isMobile = useIsMobile();

  const [dateRange, setDateRange] = useState<DateRangeMode>(DEFAULT_QUICK_RANGE);

  const [startDate, setStartDate] = useState<Date>(() => getQuickRangeDates(DEFAULT_QUICK_RANGE).start);
  const [endDate, setEndDate] = useState<Date>(() => getQuickRangeDates(DEFAULT_QUICK_RANGE).end);

  const [readings, setReadings] = useState<ReadingResponse[]>([]);
  const [chartReadings, setChartReadings] = useState<ReadingResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false);
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

    const { start, end } = getQuickRangeDates(dateRange);
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

  // Reset history on area change to trigger skeleton correctly
  useEffect(() => {
    setReadings([]);
    setChartReadings([]);
    hasFetchedRef.current = false;
    setPage(1);
  }, [selectedArea?.id]);

  // Fetch API
  useEffect(() => {
    if (!selectedArea) return;

    let isMounted = true;

    const isoStartDate = format(startDate, "yyyy-MM-dd");
    const isoEndDate = format(endDate, "yyyy-MM-dd");

    const fetchChartReadings = async (): Promise<ReadingResponse[]> => {
      const expectedPoints = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1) * 144;
      const perPage = 200;
      const maxPages = Math.min(8, Math.max(1, Math.ceil(expectedPoints / perPage)));
      const collected: ReadingResponse[] = [];

      for (let chartPage = 1; chartPage <= maxPages; chartPage += 1) {
        const chartParams = new URLSearchParams({
          irrigation_area_id: selectedArea.id.toString(),
          start_date: isoStartDate,
          end_date: isoEndDate,
          page: chartPage.toString(),
          per_page: perPage.toString(),
        });

        const chartRes = await api.get<{data: ReadingResponse[], total: number, page: number, per_page: number}>(`/readings?${chartParams}`);
        const chunk = chartRes.data.data ?? [];

        if (chunk.length === 0) {
          break;
        }

        collected.push(...chunk);

        if (chunk.length < perPage || collected.length >= (chartRes.data.total ?? 0)) {
          break;
        }
      }

      return collected;
    };

    const fetchHistorical = async () => {
      // Only show full skeleton load visually if it's the very first load or area changed
      if (!hasFetchedRef.current) setLoading(true);
      try {
        const params = new URLSearchParams({
          irrigation_area_id: selectedArea.id.toString(),
          start_date: isoStartDate,
          end_date: isoEndDate,
          page: page.toString(),
          per_page: "20"
        });

        // if cycle is selected, we could use it here. but backend filters by dates.

        const [res, chartDataResponse] = await Promise.all([
          api.get<{data: ReadingResponse[], total: number, page: number, per_page: number}>(`/readings?${params}`),
          fetchChartReadings(),
        ]);

        if (isMounted) {
          hasFetchedRef.current = true;
          setReadings(res.data.data);
          setChartReadings(chartDataResponse);
          setTotalPages(Math.ceil(res.data.total / res.data.per_page));
          setTotalItems(res.data.total);
        }
      } catch (err) {
        console.error("Failed to fetch historical readings", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistorical();

    return () => {
      isMounted = false;
    }
  }, [selectedArea, startDate, endDate, page]);

  const daySpan = Math.max(1, differenceInCalendarDays(endDate, startDate));
  const { points: chartData, bucketMs } = useMemo(
    () => aggregateReadingsForChart(chartReadings, startDate, endDate),
    [chartReadings, startDate, endDate],
  );
  const isCustomRange = dateRange === "Personalizado";
  const selectedRangeLabel = `${format(startDate, "dd MMM yyyy", { locale: es })} - ${format(endDate, "dd MMM yyyy", { locale: es })}`;

  const getXAxisTickLabel = (value: number) => {
    const date = new Date(value);

    if (daySpan <= 1) return format(date, "HH:mm", { locale: es });
    if (bucketMs < MS_IN_DAY) return format(date, "dd MMM HH:mm", { locale: es });
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
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">Datos Históricos</h1>
        <p className="text-[var(--text-subtle)]">Consulta el histórico de lecturas de {selectedArea ? selectedArea.name : "tus sensores"}</p>
      </div>

      {/* Filters */}
      <BentoCard variant="light" className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">Modo de rango</label>
            <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-1">
              <button
                type="button"
                onClick={() => {
                  if (isCustomRange) setDateRange(DEFAULT_QUICK_RANGE);
                }}
                className={`px-4 py-2 text-sm rounded-full transition-all ${
                  !isCustomRange
                    ? "bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                    : "text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                }`}
              >
                Rápido
              </button>
              <button
                type="button"
                onClick={() => setDateRange("Personalizado")}
                className={`px-4 py-2 text-sm rounded-full transition-all ${
                  isCustomRange
                    ? "bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                    : "text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {!isCustomRange && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">Presets rápidos</label>
              <div className="flex flex-wrap gap-2">
                {(["Hoy", "Últimos 7 días", "Últimos 30 días", "Este mes"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-full transition-all ${
                    dateRange === range
                      ? "bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                      : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">Rango seleccionado</p>
            <p className="mt-1 text-sm text-[var(--text-body)]">{selectedRangeLabel}</p>
            <p className="mt-1 text-xs text-[var(--text-subtle)]">Modo activo: {isCustomRange ? "Personalizado" : dateRange}</p>
          </div>
        </div>

        {isCustomRange && (
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
        )}
      </BentoCard>

      {/* Multi-line Chart */}
      <BentoCard variant="light" className="mb-6">
        <h3 className="text-lg text-[var(--text-title)] mb-6">Gráfica de Métricas</h3>

        {loading && chartData.length === 0 ? (
          <ChartSkeleton title={false} height="sm" />
        ) : chartData.length > 0 ? (
          <div className="space-y-10 lg:space-y-12">
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4 md:p-5">
              <div className="space-y-3">
                <h4 className="text-sm md:text-base text-[var(--text-body)]">Suelo + Ambiental (Temperaturas y Humedades)</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleSoilEnvSeries("soilHumidity")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.soilHumidity
                        ? "bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                        : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    Humedad suelo
                  </button>
                  <button
                    onClick={() => toggleSoilEnvSeries("relativeHumidity")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.relativeHumidity
                        ? "bg-[var(--accent-gold)] text-[var(--text-inverted)]"
                        : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    H. Relativa
                  </button>
                  <button
                    onClick={() => toggleSoilEnvSeries("soilTemp")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.soilTemp
                        ? "bg-[var(--chart-4)] text-[var(--text-inverted)]"
                        : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    Temp. suelo
                  </button>
                  <button
                    onClick={() => toggleSoilEnvSeries("airTemp")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      soilEnvSeries.airTemp
                        ? "bg-[var(--chart-3)] text-[var(--text-inverted)]"
                        : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    Temp. aire
                  </button>
                </div>

                <div className="relative h-[320px] min-h-[320px]">
                  {loading && (
                    <div className="absolute inset-0 z-10 bg-[var(--surface-page)]/60 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                      <XAxis
                        dataKey="timestampMs"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={getXAxisTickLabel}
                        minTickGap={isMobile ? 36 : 24}
                        stroke="var(--text-subtle)"
                        style={{ fontSize: '12px' }}
                      />
                      {showSoilEnvPercentAxis && (
                        <YAxis
                          yAxisId="percent"
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          stroke="var(--text-subtle)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      {showSoilEnvTempAxis && (
                        <YAxis
                          yAxisId="temp"
                          orientation="right"
                          domain={["dataMin - 2", "dataMax + 2"]}
                          tickFormatter={(v) => `${v}°C`}
                          stroke="var(--chart-4)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: '16px',
                          padding: '12px'
                        }}
                        labelFormatter={(value) =>
                          format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                        }
                        formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                        labelStyle={{ color: "var(--text-body)", marginBottom: "4px" }}
                      />
                      <Legend wrapperStyle={{ color: "var(--text-body)" }} />
                      {soilEnvSeries.soilHumidity && (
                        <Line yAxisId="percent" type="monotone" dataKey="soilHumidity" name="Humedad suelo (%)" stroke="var(--accent-primary)" strokeWidth={2.5} dot={false} />
                      )}
                      {soilEnvSeries.relativeHumidity && (
                        <Line yAxisId="percent" type="monotone" dataKey="relativeHumidity" name="H. Relativa (%)" stroke="var(--accent-gold)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      )}
                      {soilEnvSeries.soilTemp && (
                        <Line yAxisId="temp" type="monotone" dataKey="soilTemp" name="Temp. suelo (°C)" stroke="var(--chart-4)" strokeWidth={2.2} dot={false} />
                      )}
                      {soilEnvSeries.airTemp && (
                        <Line yAxisId="temp" type="monotone" dataKey="airTemp" name="Temp. aire (°C)" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4 md:p-5">
              <div className="space-y-3">
                <h4 className="text-sm md:text-base text-[var(--text-body)]">Riego + E.T.O.</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleIrrigationSeries("waterFlow")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      irrigationSeries.waterFlow
                        ? "bg-[var(--accent-gold)] text-[var(--text-inverted)]"
                        : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    Flujo de agua
                  </button>
                  <button
                    onClick={() => toggleIrrigationSeries("eto")}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                      irrigationSeries.eto
                        ? "bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                        : "bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    E.T.O.
                  </button>
                </div>

                <div className="relative h-[320px] min-h-[320px]">
                  {loading && (
                    <div className="absolute inset-0 z-10 bg-[var(--surface-page)]/60 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                      <XAxis
                        dataKey="timestampMs"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={getXAxisTickLabel}
                        minTickGap={isMobile ? 36 : 24}
                        stroke="var(--text-subtle)"
                        style={{ fontSize: '12px' }}
                      />
                      {showIrrigationFlowAxis && (
                        <YAxis
                          yAxisId="flow"
                          domain={[0, "dataMax + 2"]}
                          tickFormatter={(v) => `${v} L/min`}
                          stroke="var(--accent-gold)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      {showIrrigationEtoAxis && (
                        <YAxis
                          yAxisId="eto"
                          orientation="right"
                          domain={[0, "dataMax + 1"]}
                          tickFormatter={(v) => `${v} mm/día`}
                          stroke="var(--accent-primary)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: '16px',
                          padding: '12px'
                        }}
                        labelFormatter={(value) =>
                          format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                        }
                        formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                        labelStyle={{ color: "var(--text-body)", marginBottom: "4px" }}
                      />
                      <Legend wrapperStyle={{ color: "var(--text-body)" }} />
                      {irrigationSeries.waterFlow && (
                        <Line yAxisId="flow" type="monotone" dataKey="waterFlow" name="Flujo agua (L/min)" stroke="var(--accent-gold)" strokeWidth={2.5} dot={false} />
                      )}
                      {irrigationSeries.eto && (
                        <Line yAxisId="eto" type="monotone" dataKey="eto" name="E.T.O. (mm/día)" stroke="var(--accent-primary)" strokeWidth={2.2} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="w-full h-[120px] flex items-center justify-center text-[var(--text-subtle)]">
            {!loading && "No hay datos para el rango seleccionado"}
          </div>
        )}
      </BentoCard>

      {/* Data Table */}
      <BentoCard variant="light">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg text-[var(--text-title)]">
            Tabla de Datos{" "}
            <span className="text-sm text-[var(--text-subtle)] font-normal">
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
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="text-left py-3 px-4 text-xs uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">Fecha/Hora</th>
                <th scope="col" className="text-left py-3 px-4 text-xs uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">Humedad Suelo (%)</th>
                <th scope="col" className="text-left py-3 px-4 text-xs uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">Temp. Suelo (°C)</th>
                <th scope="col" className="text-left py-3 px-4 text-xs uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">Flujo (L/min)</th>
                <th scope="col" className="text-left py-3 px-4 text-xs uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">Temp. Aire (°C)</th>
                <th scope="col" className="text-left py-3 px-4 text-xs uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">H. Relativa (%)</th>
              </tr>
            </thead>
            <tbody className="relative">
              {!loading && readings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--text-subtle)]">No hay registros.</td>
                </tr>
              )}
              {readings.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-[var(--surface-card-primary)]/60 hover:bg-[var(--hover-overlay)]" : "hover:bg-[var(--hover-overlay)] transition-colors"}>
                  <td className="py-3 px-4 text-sm text-[var(--text-body)]">
                    {format(parseISO(r.timestamp + (r.timestamp.endsWith("Z") ? "" : "Z")), "dd MMM yyyy, HH:mm", { locale: es })}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--text-body)] font-mono-data font-medium">
                    {r.soil?.humidity?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--text-body)] font-mono-data font-medium">
                    {r.soil?.temperature?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--text-body)] font-mono-data font-medium">
                    {r.irrigation?.flow_per_minute?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--text-body)] font-mono-data font-medium">
                    {r.environmental?.temperature?.toFixed(1) ?? "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--text-body)] font-mono-data font-medium">
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
              className="px-4 py-2 rounded-full text-sm bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)] disabled:opacity-50 transition-all"
            >
              Inicio
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-full text-sm bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)] disabled:opacity-50 transition-all"
            >
              Anterior
            </button>
            <div className="px-4 text-sm text-[var(--text-subtle)] font-medium">
              Página {page} de {totalPages}
            </div>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-full text-sm bg-[var(--surface-card-primary)] border border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)] disabled:opacity-50 transition-all"
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
