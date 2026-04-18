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
import { useAuth } from "../../context/AuthContext";
import { useSelection } from "../../context/SelectionContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../services/api";

export function ClientDashboard() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { properties, areas, selectedProperty, selectedArea, setSelectedProperty, setSelectedArea } = useSelection();

  const filteredAreas = selectedProperty ? areas.filter(a => a.property_id === selectedProperty.id) : [];

  const [currentReadings, setCurrentReadings] = useState({
    soilHumidity: 0 as number | "-",
    waterFlow: 0 as number | "-",
    accumulatedWater: 0 as number | "-",
    eto: 0 as number | "-",
    irrigationActive: false,
    irrigationElapsedTime: "N/A",
    soilConductivity: 0 as number | "-",
    soilTemp: 0 as number | "-",
    waterPotential: 0 as number | "-",
    airTemp: 0 as number | "-",
    relativeHumidity: 0 as number | "-",
    windSpeed: 0 as number | "-",
    solarRadiation: 0 as number | "-",
    lastUpdate: new Date(),
  });

  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    if (selectedProperty && filteredAreas.length > 0 && !selectedArea) {
      setSelectedArea(filteredAreas[0]);
    }
  }, [selectedProperty, filteredAreas, selectedArea, setSelectedArea]);

  useEffect(() => {
    if (!selectedArea) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        const latestRes = await api.get(`/readings/latest?irrigation_area_id=${selectedArea.id}`);
        const latestData = latestRes.data;

        if (isMounted) {
          if (latestData) {
            setCurrentReadings({
              soilHumidity: latestData.soil?.humidity ?? "-",
              waterFlow: latestData.irrigation?.flow_per_minute ?? "-",
              accumulatedWater: latestData.irrigation?.accumulated_liters ?? "-",
              eto: latestData.environmental?.eto ?? "-",
              irrigationActive: latestData.irrigation?.active ?? false,
              irrigationElapsedTime: latestData.irrigation?.active ? "Activo" : "N/A",
              soilConductivity: latestData.soil?.conductivity ?? "-",
              soilTemp: latestData.soil?.temperature ?? "-",
              waterPotential: latestData.soil?.water_potential ?? "-",
              airTemp: latestData.environmental?.temperature ?? "-",
              relativeHumidity: latestData.environmental?.relative_humidity ?? "-",
              windSpeed: latestData.environmental?.wind_speed ?? "-",
              solarRadiation: latestData.environmental?.solar_radiation ?? "-",
              lastUpdate: new Date(latestData.timestamp + (latestData.timestamp.endsWith("Z") ? "" : "Z")),
            });
          } else {
            setCurrentReadings({
              soilHumidity: "-", waterFlow: "-", accumulatedWater: "-", eto: "-",
              irrigationActive: false, irrigationElapsedTime: "N/A",
              soilConductivity: "-", soilTemp: "-", waterPotential: "-",
              airTemp: "-", relativeHumidity: "-", windSpeed: "-", solarRadiation: "-",
              lastUpdate: new Date(),
            });
          }
        }

        const histRes = await api.get(`/readings?irrigation_area_id=${selectedArea.id}&per_page=12`);
        if (isMounted && histRes.data?.data) {
          const chartData = histRes.data.data.reverse().map((item: any) => {
            const t = new Date(item.timestamp + (item.timestamp.endsWith("Z") ? "" : "Z"));
            return {
              time: t.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
              fullTime: t,
              soilHumidity: item.soil?.humidity ?? 0,
              waterFlow: item.irrigation?.flow_per_minute ?? 0,
            };
          });
          setHistoricalData(chartData);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    fetchData();
    const intervalId = setInterval(() => { if (isMounted) fetchData(); }, 2000);
    return () => { isMounted = false; clearInterval(intervalId); };
  }, [selectedArea]);

  return (
    <div className="page-wrapper overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-5 animate-fade-in">
          <div>
            <h1 className="page-title">
              Hola,{" "}
              <span className="text-gradient">{user?.nombre?.split(" ")[0] || "Usuario"}</span>
            </h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Breadcrumb selectors */}
        <div className="flex flex-wrap gap-2">
          {/* Property selector */}
          <div className="relative">
            <select
              className="appearance-none pl-4 pr-9 py-2 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border-glass)",
                color: "var(--text-primary)",
                outline: "none",
              }}
              value={selectedProperty?.id ?? ""}
              onChange={e => {
                const prop = properties.find(p => p.id === Number(e.target.value));
                setSelectedProperty(prop || null);
                setSelectedArea(null);
              }}
            >
              <option value="" disabled style={{ background: "var(--bg-elevated)" }}>Seleccione predio...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id} style={{ background: "var(--bg-elevated)" }}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
          </div>

          {(selectedProperty || filteredAreas.length > 0) && (
            <div className="relative">
              <select
                className="appearance-none pl-4 pr-9 py-2 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border-glass)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
                value={selectedArea?.id ?? ""}
                onChange={e => {
                  const area = areas.find(a => a.id === Number(e.target.value));
                  setSelectedArea(area || null);
                }}
              >
                <option value="" disabled style={{ background: "var(--bg-elevated)" }}>Seleccione área...</option>
                {filteredAreas.map(a => (
                  <option key={a.id} value={a.id} style={{ background: "var(--bg-elevated)" }}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            </div>
          )}

          {/* Live indicator */}
          {selectedArea && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)" }}>
              <span className="status-dot active" />
              <span className="text-xs font-medium" style={{ color: "var(--status-active)" }}>En vivo</span>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard content */}
      {isMobile ? (
        <MobileDashboard historicalData={historicalData} currentReadings={currentReadings} />
      ) : (
        <DesktopDashboard historicalData={historicalData} currentReadings={currentReadings} />
      )}
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: "rgba(20,20,18,0.95)",
        border: "1px solid var(--border-glass)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="font-data" style={{ color: entry.color }}>
          {entry.name ?? entry.dataKey}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Desktop layout ────────────────────────────────────────────────────────────
function DesktopDashboard({ historicalData, currentReadings }: { historicalData: any[]; currentReadings: any }) {
  const humidityPct = typeof currentReadings.soilHumidity === "number" ? currentReadings.soilHumidity : 0;
  const strokeLen = 2 * Math.PI * 52;
  const strokeOffset = strokeLen * (1 - humidityPct / 100);

  return (
    <div className="grid grid-cols-12 gap-5 animate-fade-in-up">
      {/* ─ Row 1: Priority data (3 equal columns) ─ */}

      {/* Soil Humidity */}
      <div className="col-span-4">
        <MetricCard
          title="Humedad del Suelo"
          value={currentReadings.soilHumidity}
          unit="%"
          variant="priority"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
          accentColor="green"
        >
          {/* Animated circular ring */}
          <div className="relative w-28 h-28 mx-auto mt-2">
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,0.06)" strokeWidth="7" fill="none" />
              <circle
                cx="60" cy="60" r="52"
                stroke="url(#humGrad)"
                strokeWidth="7" fill="none"
                strokeLinecap="round"
                strokeDasharray={strokeLen}
                strokeDashoffset={strokeOffset}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
              <defs>
                <linearGradient id="humGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--accent-green)" />
                  <stop offset="100%" stopColor="var(--accent-gold)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-data text-xl font-bold" style={{ color: "var(--accent-green)" }}>{humidityPct}%</span>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Water Flow */}
      <div className="col-span-4">
        <MetricCard
          title="Flujo de Agua"
          value={currentReadings.waterFlow}
          unit="L/min"
          variant="priority"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
          accentColor="green"
        >
          {/* Sparkline */}
          <div className="h-14 -mx-2 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData.slice(-12)}>
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="waterFlow" stroke="var(--accent-green)" fill="url(#flowGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Acumulado: <span className="font-data" style={{ color: "var(--text-secondary)" }}>{currentReadings.accumulatedWater} L</span>
          </p>
        </MetricCard>
      </div>

      {/* ETO */}
      <div className="col-span-4">
        <MetricCard
          title="E.T.O."
          value={currentReadings.eto}
          unit="mm/día"
          variant="gold"
          subtitle="Evapotranspiración"
          lastUpdate={currentReadings.lastUpdate}
          priority
          accentColor="gold"
        />
      </div>

      {/* ─ Row 2: Irrigation status + Soil ─ */}
      <div className="col-span-4">
        <BentoCard variant="glass" className="h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title" style={{ fontSize: "0.95rem" }}>Estado del Riego</h3>
            <div className="flex items-center gap-2">
              <span className={`status-dot ${currentReadings.irrigationActive ? "active" : "inactive"}`} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Estado</span>
              <span
                className="text-sm font-semibold"
                style={{ color: currentReadings.irrigationActive ? "var(--status-active)" : "var(--text-muted)" }}
              >
                {currentReadings.irrigationActive ? "ACTIVO" : "INACTIVO"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Tiempo transcurrido</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {currentReadings.irrigationElapsedTime}
              </span>
            </div>
          </div>
        </BentoCard>
      </div>

      <div className="col-span-8">
        <BentoCard variant="glass">
          <h3 className="section-title mb-4" style={{ fontSize: "0.95rem" }}>Datos de Suelo</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Conductividad", val: currentReadings.soilConductivity, unit: "dS/m" },
              { label: "Temperatura", val: currentReadings.soilTemp, unit: "°C" },
              { label: "Potencial Hídrico", val: currentReadings.waterPotential, unit: "MPa" },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                <p className="font-data text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {m.val}
                  <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>{m.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>

      {/* ─ Row 3: Chart + Environmental ─ */}
      <div className="col-span-8 row-span-2">
        <BentoCard variant="glass" className="h-full">
          <h3 className="section-title mb-5" style={{ fontSize: "0.95rem" }}>Humedad del Suelo — Últimas Lecturas</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="humAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                    <stop offset="90%" stopColor="var(--accent-green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="soilHumidity"
                  name="Humedad"
                  stroke="var(--accent-green)"
                  strokeWidth={2.5}
                  fill="url(#humAreaGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--accent-green)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <FreshnessIndicator lastUpdate={currentReadings.lastUpdate} />
          </div>
        </BentoCard>
      </div>

      {/* Environmental */}
      <div className="col-span-4">
        <BentoCard variant="glass" className="h-full">
          <h3 className="section-title mb-4" style={{ fontSize: "0.95rem" }}>Ambiental</h3>
          <div className="space-y-3">
            {[
              { icon: Sun, label: "Temp. Aire", val: currentReadings.airTemp, unit: "°C", accent: "#FBBF24" },
              { icon: Droplets, label: "Hum. Relativa", val: currentReadings.relativeHumidity, unit: "%", accent: "var(--accent-green)" },
              { icon: Wind, label: "Viento", val: currentReadings.windSpeed, unit: "km/h", accent: "#5B9BD5" },
              { icon: Zap, label: "Rad. Solar", val: currentReadings.solarRadiation, unit: "W/m²", accent: "var(--accent-gold)" },
            ].map(({ icon: Icon, label, val, unit, accent }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                </div>
                <span className="font-data text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {val} <span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>{unit}</span>
                </span>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}

// ── Mobile layout ─────────────────────────────────────────────────────────────
function MobileDashboard({ historicalData, currentReadings }: { historicalData: any[]; currentReadings: any }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <MetricCard title="Humedad del Suelo" value={currentReadings.soilHumidity} unit="%" variant="priority" subtitle="Dato prioritario" lastUpdate={currentReadings.lastUpdate} priority accentColor="green" />
      <MetricCard title="Flujo de Agua" value={currentReadings.waterFlow} unit="L/min" variant="priority" subtitle="Dato prioritario" lastUpdate={currentReadings.lastUpdate} accentColor="green">
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Acumulado: {currentReadings.accumulatedWater} L</p>
      </MetricCard>
      <MetricCard title="E.T.O." value={currentReadings.eto} unit="mm/día" variant="gold" subtitle="Evapotranspiración" lastUpdate={currentReadings.lastUpdate} accentColor="gold" />

      {/* Chart */}
      <BentoCard variant="glass">
        <h3 className="section-title mb-3" style={{ fontSize: "0.9rem" }}>Últimas Lecturas</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="mobHumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Area type="monotone" dataKey="soilHumidity" name="Humedad" stroke="var(--accent-green)" strokeWidth={2} fill="url(#mobHumGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      {/* Riego status */}
      <BentoCard variant="glass">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title" style={{ fontSize: "0.9rem" }}>Estado del Riego</h3>
          <span className={`status-dot ${currentReadings.irrigationActive ? "active" : "inactive"}`} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Estado</span>
          <span className="text-sm font-bold" style={{ color: currentReadings.irrigationActive ? "var(--status-active)" : "var(--text-muted)" }}>
            {currentReadings.irrigationActive ? "ACTIVO" : "INACTIVO"}
          </span>
        </div>
      </BentoCard>

      {/* Soil metrics */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
        {[
          { label: "Conductividad", val: currentReadings.soilConductivity, unit: "dS/m" },
          { label: "Temperatura", val: currentReadings.soilTemp, unit: "°C" },
          { label: "Potencial Hídrico", val: currentReadings.waterPotential, unit: "MPa" },
        ].map(m => (
          <BentoCard key={m.label} variant="sand" className="min-w-[160px] flex-shrink-0">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
            <p className="font-data text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {m.val} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>{m.unit}</span>
            </p>
          </BentoCard>
        ))}
      </div>

      {/* Environmental */}
      <BentoCard variant="glass">
        <h3 className="section-title mb-3" style={{ fontSize: "0.9rem" }}>Ambiental</h3>
        <div className="space-y-2.5">
          {[
            { label: "Temperatura aire", val: currentReadings.airTemp, unit: "°C" },
            { label: "Humedad relativa", val: currentReadings.relativeHumidity, unit: "%" },
            { label: "Viento", val: currentReadings.windSpeed, unit: "km/h" },
            { label: "Radiación solar", val: currentReadings.solarRadiation, unit: "W/m²" },
          ].map(m => (
            <div key={m.label} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{m.label}</span>
              <span className="font-data text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.val} {m.unit}</span>
            </div>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}
