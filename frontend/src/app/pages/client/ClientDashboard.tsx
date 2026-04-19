import { Bell, ChevronDown, Droplets, Sun, Wind, Zap } from "lucide-react";
import { useEffect, useState } from "react";
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

const DASHBOARD_REFRESH_MS = 30000;

function getSemaphoreLabel(level: SemaphoreLevel): string {
  if (level === "critical") return "Crítico";
  if (level === "warning") return "Riesgo";
  return "Óptimo";
}

function getSemaphoreClass(level: SemaphoreLevel): string {
  if (level === "critical") return "bg-[#F8D2D2] text-[#7F1D1D]";
  if (level === "warning") return "bg-[#F6E4B8] text-[#6B4B14]";
  return "bg-[#D8E7D0] text-[#2E5C35]";
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
    lastUpdate: new Date(),
  });

  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [prioritySemaphore, setPrioritySemaphore] = useState<Record<PriorityKey, SemaphoreLevel>>(defaultSemaphore);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedProperty && filteredAreas.length > 0 && !selectedArea) {
      setSelectedArea(filteredAreas[0]);
    }
  }, [selectedProperty, filteredAreas, selectedArea, setSelectedArea]);

  useEffect(() => {
    if (!selectedArea || !isPageVisible) return;

    let isMounted = true;
    let inFlight = false;
    const areaId = selectedArea.id;

    const fetchData = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);

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
              lastUpdate: new Date(latestData.timestamp + (latestData.timestamp.endsWith("Z") ? "" : "Z")),
            });
          } else {
            setCurrentReadings({
              soilHumidity: '-', waterFlow: '-', accumulatedWater: '-', eto: '-',
              irrigationActive: false, irrigationElapsedTime: "N/A",
              soilConductivity: '-', soilTemp: '-', waterPotential: '-',
              airTemp: '-', relativeHumidity: '-', windSpeed: '-', solarRadiation: '-',
              lastUpdate: new Date(),
            });
          }
        }

        if (isMounted && histRes.data?.data) {
          const rawItems = histRes.data.data;
          const chartData = rawItems.reverse().map((item: any) => {
            const t = new Date(item.timestamp + (item.timestamp.endsWith("Z") ? "" : "Z"));
            return {
              time: t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              fullTime: t,
              soilHumidity: item.soil?.humidity ?? 0,
              waterFlow: item.irrigation?.flow_per_minute ?? 0,
            };
          });
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

          setPrioritySemaphore(nextSemaphore);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        inFlight = false;
        setLoading(false);
      }
    };

    fetchData();

    const intervalId = window.setInterval(() => {
      if (isMounted) {
        fetchData();
      }
    }, DASHBOARD_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [selectedArea, isPageVisible]);


  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-1">
              Hola, {user?.nombre || 'Usuario'}
            </h1>
            <p className="text-[#6E6359]">
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button className="p-3 rounded-full bg-[#F9F8F4] hover:bg-[#E2D4B7]/30 transition-colors">
            <Bell className="w-5 h-5 text-[#6E6359]" />
          </button>
        </div>

        {/* Breadcrumb selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select
              className="appearance-none flex items-center gap-2 pl-4 pr-10 py-2 rounded-full bg-[#F9F8F4] text-[#2C2621] hover:bg-[#E2D4B7]/30 transition-colors font-medium outline-none cursor-pointer"
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
            <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#2C2621]" />
          </div>

          {(selectedProperty || filteredAreas.length > 0) && (
            <div className="relative">
              <select
                className="appearance-none flex items-center gap-2 pl-4 pr-10 py-2 rounded-full bg-[#F9F8F4] text-[#2C2621] hover:bg-[#E2D4B7]/30 transition-colors font-medium outline-none cursor-pointer"
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
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#2C2621]" />
            </div>
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
                stroke="#F4F1EB"
                strokeWidth="8"
                fill="none"
                opacity="0.2"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#A68A61"
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
                  stroke="#A68A61"
                  fill="#A68A61"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[#F4F1EB]/70 mt-2">
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
            <div className="flex items-center gap-1 text-[#A68A61]">
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
            <h3 className="text-lg text-[#2C2621]">Estado del Riego</h3>
            <div className="relative flex items-center justify-center w-4 h-4">
              {currentReadings.irrigationActive && (
                <span
                  className="absolute inline-flex w-full h-full rounded-full bg-[#6D7E5E] opacity-50"
                  style={{ animation: "rippleExpand 2s ease-out infinite" }}
                />
              )}
              <span
                className={`relative block w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                  currentReadings.irrigationActive ? 'bg-[#6D7E5E]' : 'bg-[#6E6359]'
                }`}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#6E6359]">Estado</span>
              <span className={`font-bold ${currentReadings.irrigationActive ? 'text-[#6D7E5E]' : 'text-[#6E6359]'}`}>
                {currentReadings.irrigationActive ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6359]">Tiempo transcurrido</span>
              <span className="font-bold text-[#2C2621]">
                {currentReadings.irrigationElapsedTime}
              </span>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Soil Metrics (Row 2) */}
      <div className="col-span-8">
        <BentoCard variant="light">
          <h3 className="text-lg text-[#2C2621] mb-4">Suelo</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Conductividad</p>
              <p className="text-2xl font-bold text-[#2C2621]">
                {currentReadings.soilConductivity}{" "}
                <span className="text-base text-[#6E6359]">dS/m</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Temperatura</p>
              <p className="text-2xl font-bold text-[#2C2621]">
                {currentReadings.soilTemp}{" "}
                <span className="text-base text-[#6E6359]">°C</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Potencial hídrico</p>
              <p className="text-2xl font-bold text-[#2C2621]">
                {currentReadings.waterPotential}{" "}
                <span className="text-base text-[#6E6359]">MPa</span>
              </p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Chart (Row 3) */}
      <div className="col-span-8 row-span-2 animate-stagger-3">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[#2C2621] mb-6">
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
                    <stop offset="5%" stopColor="#6D7E5E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6D7E5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" />
                <XAxis
                  dataKey="time"
                  stroke="#6E6359"
                  style={{ fontSize: "12px" }}
                  minTickGap={32}
                  interval="preserveStartEnd"
                  tick={{ fill: "#6E6359" }}
                />
                <YAxis
                  stroke="#6E6359"
                  style={{ fontSize: "12px" }}
                  domain={["auto", "auto"]}
                  tick={{ fill: "#6E6359" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#F9F8F4",
                    border: "1px solid #E6E1D8",
                    borderRadius: "16px",
                    padding: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soilHumidity"
                  stroke="#6D7E5E"
                  strokeWidth={3}
                  fill="url(#colorHumidity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <FreshnessIndicator lastUpdate={currentReadings.lastUpdate} />
        </BentoCard>
      </div>

      {/* Environmental Metrics (Row 3-4) */}
      <div className="col-span-4">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[#2C2621] mb-4">Ambiental</h3>
          <div className="divide-y divide-[#2C2621]/5 rounded-[24px] overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Sun className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Temperatura aire</p>
                  <p className="font-bold text-[#2C2621]">
                    {currentReadings.airTemp} °C
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Droplets className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Humedad relativa</p>
                  <p className="font-bold text-[#2C2621]">
                    {currentReadings.relativeHumidity} %
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Wind className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Viento</p>
                  <p className="font-bold text-[#2C2621]">
                    {currentReadings.windSpeed} km/h
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Zap className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Radiación solar</p>
                  <p className="font-bold text-[#2C2621]">
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
        <h3 className="text-base text-[#2C2621] mb-3">Semáforos de Umbral</h3>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between rounded-[16px] bg-[#F4F1EB] px-3 py-2">
            <span className="text-sm text-[#5F5549]">Humedad suelo</span>
            <SemaphorePill level={prioritySemaphore["soil.humidity"]} />
          </div>
          <div className="flex items-center justify-between rounded-[16px] bg-[#F4F1EB] px-3 py-2">
            <span className="text-sm text-[#5F5549]">Flujo agua</span>
            <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
          </div>
          <div className="flex items-center justify-between rounded-[16px] bg-[#F4F1EB] px-3 py-2">
            <span className="text-sm text-[#5F5549]">ETO</span>
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
        <p className="text-sm text-[#F4F1EB]/70 mt-2">
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
        <h3 className="text-lg text-[#2C2621] mb-4">Últimas 24 horas</h3>
        <div className="h-[200px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6D7E5E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6D7E5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="#6E6359"
                style={{ fontSize: "10px" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#6E6359"
                style={{ fontSize: "10px" }}
                domain={[30, 60]}
              />
              <Area
                type="monotone"
                dataKey="soilHumidity"
                stroke="#6D7E5E"
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
          <h3 className="text-lg text-[#2C2621]">Estado del Riego</h3>
          <div className={`w-3 h-3 rounded-full ${currentReadings.irrigationActive ? 'bg-[#6D7E5E] animate-pulse' : 'bg-[#6E6359]'}`} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Estado</span>
            <span className={`font-bold ${currentReadings.irrigationActive ? 'text-[#6D7E5E]' : 'text-[#6E6359]'}`}>
              {currentReadings.irrigationActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Tiempo transcurrido</span>
            <span className="font-bold text-[#2C2621]">
              {currentReadings.irrigationElapsedTime}
            </span>
          </div>
        </div>
      </BentoCard>

      {/* Horizontal scroll cards for secondary metrics */}
      <div>
        <h3 className="text-lg text-[#2C2621] mb-3">Métricas de Suelo</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[#6E6359] mb-1">Conductividad</p>
            <p className="text-2xl font-bold text-[#2C2621]">
              {currentReadings.soilConductivity}{" "}
              <span className="text-base text-[#6E6359]">dS/m</span>
            </p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[#6E6359] mb-1">Temperatura</p>
            <p className="text-2xl font-bold text-[#2C2621]">
              {currentReadings.soilTemp}{" "}
              <span className="text-base text-[#6E6359]">°C</span>
            </p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[#6E6359] mb-1">Potencial hídrico</p>
            <p className="text-2xl font-bold text-[#2C2621]">
              {currentReadings.waterPotential}{" "}
              <span className="text-base text-[#6E6359]">MPa</span>
            </p>
          </BentoCard>
        </div>
      </div>

      {/* Environmental */}
      <BentoCard variant="light">
        <h3 className="text-lg text-[#2C2621] mb-4">Ambiental</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Temperatura aire</span>
            <span className="font-bold text-[#2C2621]">
              {currentReadings.airTemp} °C
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Humedad relativa</span>
            <span className="font-bold text-[#2C2621]">
              {currentReadings.relativeHumidity} %
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Viento</span>
            <span className="font-bold text-[#2C2621]">
              {currentReadings.windSpeed} km/h
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Radiación solar</span>
            <span className="font-bold text-[#2C2621]">
              {currentReadings.solarRadiation} W/m²
            </span>
          </div>
        </div>
      </BentoCard>
    </div>
  );
}
