import { ChevronDown, Droplets, Sun, Wind, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { MetricCard } from "../../components/MetricCard";
import { MetricSkeletonGrid } from "../../components/MetricSkeleton";
import { useAuth } from "../../context/AuthContext";
import { useSelection } from "../../context/SelectionContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { api } from "../../services/api";
import { parseBackendTimestamp } from "../../utils/datetime";

type PriorityKey = "soil.humidity" | "irrigation.flow_per_minute" | "environmental.eto";
type SemaphoreLevel = "optimal" | "warning" | "critical";

type PriorityStatusItem = {
  parameter: string;
  level: SemaphoreLevel;
};

const defaultSemaphore: Record<PriorityKey, SemaphoreLevel> = {
  "soil.humidity": "optimal",
  "irrigation.flow_per_minute": "optimal",
  "environmental.eto": "optimal",
};

// Intervalo de auto-refresco del dashboard: 3000ms (3s) para propósitos de prueba de tiempo real (originalmente 30000ms - 30s)
const DASHBOARD_REFRESH_MS = 3000;
const FRESH_MINUTES_THRESHOLD = 20;

type ConnectionState = "online" | "warning" | "offline" | "no_data";

function getConnectionState(lastUpdate: Date | null): ConnectionState {
  if (!lastUpdate) return "no_data";
  const minutesAgo = Math.max(0, Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60)));
  if (minutesAgo < FRESH_MINUTES_THRESHOLD) return "online";
  if (minutesAgo < 120) return "warning";
  return "offline";
}

function getSemaphoreLabel(level: SemaphoreLevel): string {
  if (level === "critical") return "Crítico";
  if (level === "warning") return "Riesgo";
  return "Óptimo";
}

function getSemaphoreClass(level: SemaphoreLevel): string {
  if (level === "critical") return "bg-[var(--status-danger-bg)] text-[var(--status-danger)]";
  if (level === "warning") return "bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
  return "bg-[var(--status-active-bg)] text-[var(--status-active)]";
}

function SemaphorePill({ level }: { level: SemaphoreLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getSemaphoreClass(level)}`}>
      {getSemaphoreLabel(level)}
    </span>
  );
}

export function ClientDashboard() {
  const isMobile = useIsMobile();
  const isPageVisible = usePageVisibility();
  const { user } = useAuth();
  const {
    properties,
    areas,
    selectedProperty,
    selectedArea,
    setSelectedProperty,
    setSelectedArea
  } = useSelection();

  const filteredAreas = selectedProperty
    ? areas.filter(a => a.property_id === selectedProperty.id)
    : [];

  const [currentReadings, setCurrentReadings] = useState({
    soilHumidity: 0 as number | '-',
    waterFlow: 0 as number | '-',
    accumulatedWater: 0 as number | '-',
    eto: 0 as number | '-',
    irrigationActive: false,
    irrigationElapsedTime: "N/A",
    soilConductivity: 0 as number | '-',
    soilTemp: 0 as number | '-',
    waterPotential: 0 as number | '-',
    airTemp: 0 as number | '-',
    relativeHumidity: 0 as number | '-',
    windSpeed: 0 as number | '-',
    solarRadiation: 0 as number | '-',
    lastUpdate: null as Date | null,
  });

  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const hasFetchedInitialRef = useRef(false);
  const [prioritySemaphore, setPrioritySemaphore] = useState<Record<PriorityKey, SemaphoreLevel>>(defaultSemaphore);
  const [loading, setLoading] = useState(false);
  const connectionState = getConnectionState(currentReadings.lastUpdate);

  useEffect(() => {
    if (selectedProperty && filteredAreas.length > 0 && !selectedArea) {
      setSelectedArea(filteredAreas[0]);
    }
  }, [selectedProperty, filteredAreas, selectedArea, setSelectedArea]);

  useEffect(() => {
    // Si cambia el área seleccionada, borramos datos anteriores para que retorne a loading skeleton real
    setHistoricalData([]);
    hasFetchedInitialRef.current = false;
  }, [selectedArea?.id]);

  useEffect(() => {
    // Solo detenemos si no hay área, NO paramos de montar el effect si no estamos en focus.
    if (!selectedArea) return;

    let isMounted = true;
    let inFlight = false;
    const areaId = selectedArea.id;

    const fetchData = async () => {
      // Si ya hay request activo, o la página NO está visible, no solicitamos.
      if (inFlight || !isPageVisible) return;
      inFlight = true;
      // Solo mostrar skeleton si es la primera carga para esta área
      if (!hasFetchedInitialRef.current) {
        setLoading(true);
      }

      try {
        const [latestRes, histRes, priorityRes] = await Promise.all([
          api.get(`/readings/latest?irrigation_area_id=${areaId}`),
          api.get(`/readings?irrigation_area_id=${areaId}&per_page=12`),
          api.get(`/readings/priority-status?irrigation_area_id=${areaId}`),
        ]);

        const latestData = latestRes.data;

        if (isMounted) {
          if (latestData) {
            setCurrentReadings({
              soilHumidity: latestData.soil?.humidity ?? '-',
              waterFlow: latestData.irrigation?.flow_per_minute ?? '-',
              accumulatedWater: latestData.irrigation?.accumulated_liters ?? '-',
              eto: latestData.environmental?.eto ?? '-',
              irrigationActive: latestData.irrigation?.active ?? false,
              irrigationElapsedTime: latestData.irrigation?.active ? "Activo" : "N/A",
              soilConductivity: latestData.soil?.conductivity ?? '-',
              soilTemp: latestData.soil?.temperature ?? '-',
              waterPotential: latestData.soil?.water_potential ?? '-',
              airTemp: latestData.environmental?.temperature ?? '-',
              relativeHumidity: latestData.environmental?.relative_humidity ?? '-',
              windSpeed: latestData.environmental?.wind_speed ?? '-',
              solarRadiation: latestData.environmental?.solar_radiation ?? '-',
              lastUpdate: parseBackendTimestamp(latestData.timestamp),
            });
          } else {
            setCurrentReadings({
              soilHumidity: '-', waterFlow: '-', accumulatedWater: '-', eto: '-',
              irrigationActive: false, irrigationElapsedTime: "N/A",
              soilConductivity: '-', soilTemp: '-', waterPotential: '-',
              airTemp: '-', relativeHumidity: '-', windSpeed: '-', solarRadiation: '-',
              lastUpdate: null,
            });
          }
        }

        if (isMounted && histRes.data?.data) {
          const rawItems = histRes.data.data;
          const chartData = rawItems.reverse().map((item: any) => {
            const t = parseBackendTimestamp(item.timestamp);
            if (!t) {
              return null;
            }
            return {
              time: t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              fullTime: t,
              soilHumidity: item.soil?.humidity ?? 0,
              waterFlow: item.irrigation?.flow_per_minute ?? 0,
            };
          }).filter(Boolean);
          setHistoricalData(chartData);
        }

        if (isMounted) {
          const items: PriorityStatusItem[] = priorityRes.data?.items ?? [];
          const nextSemaphore: Record<PriorityKey, SemaphoreLevel> = {
            ...defaultSemaphore,
          };

          for (const item of items) {
            if (!(item.parameter in nextSemaphore)) continue;
            const key = item.parameter as PriorityKey;
            if (
              item.level === "optimal" ||
              item.level === "warning" ||
              item.level === "critical"
            ) {
              nextSemaphore[key] = item.level;
            }
          }

          if (isMounted) {
            hasFetchedInitialRef.current = true;
            setPrioritySemaphore(nextSemaphore);
          }
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        inFlight = false;
        if (isMounted) setLoading(false);
      }
    };

    // Llamada inicial (depende de isPageVisible para disparar si se acaba de volver la pestaña visible)
    fetchData();

    const intervalId = window.setInterval(() => {
      // Revisa visibility dentro del refetch en intervalo.
      if (isMounted) fetchData();
    }, DASHBOARD_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [selectedArea, isPageVisible]);


  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl md:text-3xl text-[var(--text-title)]">
              Hola, {user?.nombre || 'Usuario'}
            </h1>
            <p className="text-[var(--text-subtle)]">
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Breadcrumb selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select
              className="appearance-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] py-2 pl-4 pr-10 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              value={selectedProperty?.id ?? ""}
              onChange={(e) => {
                const prop = properties.find(p => p.id === Number(e.target.value));
                setSelectedProperty(prop || null);
                setSelectedArea(null);
              }}
            >
              <option value="" disabled>Seleccione predio...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          </div>

          {(selectedProperty || filteredAreas.length > 0) && (
            <div className="relative">
              <select
                className="appearance-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] py-2 pl-4 pr-10 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                value={selectedArea?.id ?? ""}
                onChange={(e) => {
                  const area = areas.find(a => a.id === Number(e.target.value));
                  setSelectedArea(area || null);
                }}
              >
                <option value="" disabled>Seleccione área...</option>
                {filteredAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            </div>
          )}

          {selectedArea && (
            <>
              {connectionState === "online" && (
                <div className="inline-flex items-center rounded-full border border-[var(--status-active)]/35 bg-[var(--status-active-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-active)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--status-active)] animate-glow-pulse" />
                  En línea
                </div>
              )}
              {connectionState === "warning" && (
                <div className="inline-flex items-center rounded-full border border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-warning)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--status-warning)]" />
                  Sin reporte reciente
                </div>
              )}
              {connectionState === "offline" && (
                <div className="inline-flex items-center rounded-full border border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-danger)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--status-danger)]" />
                  Sin conexión
                </div>
              )}
              {connectionState === "no_data" && (
                <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-subtle)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--text-muted)]" />
                  Sin lecturas
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bento Grid Layout */}
      {!selectedArea ? null : loading ? (
        <MetricSkeletonGrid count={isMobile ? 3 : 6} />
      ) : isMobile ? (
        <MobileDashboard
          historicalData={historicalData}
          currentReadings={currentReadings}
          prioritySemaphore={prioritySemaphore}
        />
      ) : (
        <DesktopDashboard
          historicalData={historicalData}
          currentReadings={currentReadings}
          prioritySemaphore={prioritySemaphore}
        />
      )}
    </div>
  );
}

function DesktopDashboard({
  historicalData,
  currentReadings,
  prioritySemaphore,
}: {
  historicalData: any[];
  currentReadings: any;
  prioritySemaphore: Record<PriorityKey, SemaphoreLevel>;
}) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Priority Data - Dark Cards (Row 1) */}
      <div className="col-span-4">
        <MetricCard
          title="Humedad del Suelo"
          value={currentReadings.soilHumidity}
          unit="%"
          variant="dark"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["soil.humidity"]} />
          </div>
          {/* Circular progress ring */}
          <div className="relative w-32 h-32 mx-auto my-4">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="var(--border-strong)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="var(--accent-gold)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - (typeof currentReadings.soilHumidity === 'number' ? currentReadings.soilHumidity : 0) / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
          </div>
        </MetricCard>
      </div>

      <div className="col-span-4">
        <MetricCard
          title="Flujo de Agua"
          value={currentReadings.waterFlow}
          unit="L/min"
          variant="dark"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
          </div>
          {/* Sparkline */}
          <div className="h-16 min-h-[64px] -mx-2 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData.slice(-12)}>
                <Area
                  type="monotone"
                  dataKey="waterFlow"
                  stroke="var(--accent-gold)"
                  fill="var(--accent-gold)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[var(--text-on-dark)]/70 mt-2 font-mono-data">
            Acumulado: {currentReadings.accumulatedWater} L
          </p>
        </MetricCard>
      </div>

      <div className="col-span-4">
        <MetricCard
          title="E.T.O."
          value={currentReadings.eto}
          unit="mm/día"
          variant="dark"
          subtitle="Evapotranspiración"
          lastUpdate={currentReadings.lastUpdate}
          priority
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["environmental.eto"]} />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1 text-[var(--accent-gold)]">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span className="text-sm">+0.3 vs ayer</span>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Irrigation Status (Row 2) */}
      <div className="col-span-4 animate-stagger-1">
        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg text-[var(--text-main)]">Estado del Riego</h3>
            <div className="relative flex items-center justify-center w-4 h-4">
              {currentReadings.irrigationActive && (
                <span
                  className="absolute inline-flex w-full h-full rounded-full bg-[var(--accent-primary)] opacity-50"
                  style={{ animation: "rippleExpand 2s ease-out infinite" }}
                />
              )}
              <span
                className={`relative block w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                  currentReadings.irrigationActive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'
                }`}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Estado</span>
              <span className={`font-bold ${currentReadings.irrigationActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                {currentReadings.irrigationActive ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Tiempo transcurrido</span>
              <span className="font-bold text-[var(--text-main)]">
                {currentReadings.irrigationElapsedTime}
              </span>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Soil Metrics (Row 2) */}
      <div className="col-span-8">
        <BentoCard variant="light">
          <h3 className="text-lg text-[var(--text-main)] mb-4">Suelo</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Conductividad</p>
              <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
                {currentReadings.soilConductivity}{" "}
                <span className="text-base text-[var(--text-muted)] font-sans">dS/m</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Temperatura</p>
              <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
                {currentReadings.soilTemp}{" "}
                <span className="text-base text-[var(--text-muted)] font-sans">°C</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Potencial hídrico</p>
              <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
                {currentReadings.waterPotential}{" "}
                <span className="text-base text-[var(--text-muted)] font-sans">MPa</span>
              </p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Chart (Row 3) */}
      <div className="col-span-8 row-span-2 animate-stagger-3">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[var(--text-main)] mb-6">
            Humedad del Suelo - Últimas 24 horas
          </h3>
          <div className="h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient
                    id="colorHumidity"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                <XAxis
                  dataKey="time"
                  stroke="var(--text-muted)"
                  style={{ fontSize: "12px" }}
                  minTickGap={32}
                  interval="preserveStartEnd"
                  tick={{ fill: "var(--text-muted)" }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  style={{ fontSize: "12px" }}
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--text-muted)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "16px",
                    padding: "12px",
                    color: "var(--text-main)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soilHumidity"
                  stroke="var(--accent-primary)"
                  strokeWidth={3}
                  fill="url(#colorHumidity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {currentReadings.lastUpdate && (
            <FreshnessIndicator lastUpdate={currentReadings.lastUpdate} />
          )}
        </BentoCard>
      </div>

      {/* Environmental Metrics (Row 3-4) */}
      <div className="col-span-4">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[var(--text-main)] mb-4">Ambiental</h3>
          <div className="divide-y divide-[var(--border-subtle)] rounded-[24px] overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Sun className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Temperatura aire</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.airTemp} °C
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Droplets className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Humedad relativa</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.relativeHumidity} %
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Wind className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Viento</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.windSpeed} km/h
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Zap className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Radiación solar</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.solarRadiation} W/m²
                  </p>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}

function MobileDashboard({
  historicalData,
  currentReadings,
  prioritySemaphore,
}: {
  historicalData: any[];
  currentReadings: any;
  prioritySemaphore: Record<PriorityKey, SemaphoreLevel>;
}) {
  return (
    <div className="space-y-4">
      <BentoCard variant="light">
        <h3 className="text-base text-[var(--text-main)] mb-3">Semáforos de Umbral</h3>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2">
            <span className="text-sm text-[var(--text-muted)]">Humedad suelo</span>
            <SemaphorePill level={prioritySemaphore["soil.humidity"]} />
          </div>
          <div className="flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2">
            <span className="text-sm text-[var(--text-muted)]">Flujo agua</span>
            <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
          </div>
          <div className="flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2">
            <span className="text-sm text-[var(--text-muted)]">ETO</span>
            <SemaphorePill level={prioritySemaphore["environmental.eto"]} />
          </div>
        </div>
      </BentoCard>

      {/* Priority cards first */}
      <MetricCard
        title="Humedad del Suelo"
        value={currentReadings.soilHumidity}
        unit="%"
        variant="dark"
        subtitle="Dato prioritario"
        lastUpdate={currentReadings.lastUpdate}
        priority
      />

      <MetricCard
        title="Flujo de Agua"
        value={currentReadings.waterFlow}
        unit="L/min"
        variant="dark"
        subtitle="Dato prioritario"
        lastUpdate={currentReadings.lastUpdate}
      >
        <div className="mb-2">
          <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
        </div>
        <p className="text-sm text-[var(--text-on-dark)]/70 mt-2">
          Acumulado: {currentReadings.accumulatedWater} L
        </p>
      </MetricCard>

      <MetricCard
        title="E.T.O."
        value={currentReadings.eto}
        unit="mm/día"
        variant="dark"
        subtitle="Evapotranspiración"
        lastUpdate={currentReadings.lastUpdate}
      >
        <div className="mb-2">
          <SemaphorePill level={prioritySemaphore["environmental.eto"]} />
        </div>
      </MetricCard>

      {/* Chart */}
      <BentoCard variant="light">
        <h3 className="text-lg text-[var(--text-main)] mb-4">Últimas 24 horas</h3>
        <div className="h-[200px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="var(--text-muted)"
                style={{ fontSize: "10px" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--text-muted)"
                style={{ fontSize: "10px" }}
                domain={[30, 60]}
              />
              <Area
                type="monotone"
                dataKey="soilHumidity"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                fill="url(#colorHumidity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      {/* Status */}
      <BentoCard variant="sand">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg text-[var(--text-main)]">Estado del Riego</h3>
          <div className={`w-3 h-3 rounded-full ${currentReadings.irrigationActive ? 'bg-[var(--accent-primary)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Estado</span>
            <span className={`font-bold ${currentReadings.irrigationActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
              {currentReadings.irrigationActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Tiempo transcurrido</span>
            <span className="font-bold text-[var(--text-main)]">
              {currentReadings.irrigationElapsedTime}
            </span>
          </div>
        </div>
      </BentoCard>

      {/* Horizontal scroll cards for secondary metrics */}
      <div>
        <h3 className="text-lg text-[var(--text-main)] mb-3">Métricas de Suelo</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Conductividad</p>
            <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.soilConductivity}{" "}
              <span className="text-base text-[var(--text-muted)] font-sans">dS/m</span>
            </p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Temperatura</p>
            <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.soilTemp}{" "}
              <span className="text-base text-[var(--text-muted)] font-sans">°C</span>
            </p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Potencial hídrico</p>
            <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.waterPotential}{" "}
              <span className="text-base text-[var(--text-muted)] font-sans">MPa</span>
            </p>
          </BentoCard>
        </div>
      </div>

      {/* Environmental */}
      <BentoCard variant="light">
        <h3 className="text-lg text-[var(--text-main)] mb-4">Ambiental</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Temperatura aire</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.airTemp} °C
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Humedad relativa</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.relativeHumidity} %
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Viento</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.windSpeed} km/h
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Radiación solar</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.solarRadiation} W/m²
            </span>
          </div>
        </div>
      </BentoCard>
    </div>
  );
}
