import { useState } from "react";
import { Bell, ChevronDown, Droplets, Wind, Zap, Sun } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { MetricCard } from "../../components/MetricCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { PillButton } from "../../components/PillButton";
import { currentReadings, generateHistoricalData } from "../../data/mockData";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useIsMobile } from "../../hooks/useIsMobile";

export function ClientDashboard() {
  const isMobile = useIsMobile();
  const [selectedArea, setSelectedArea] = useState("Nogal Norte");
  const historicalData = generateHistoricalData();

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-1">Hola, Juan</h1>
            <p className="text-[#6E6359]">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <button className="p-3 rounded-full bg-[#F9F8F4] hover:bg-[#E2D4B7]/30 transition-colors">
            <Bell className="w-5 h-5 text-[#6E6359]" />
          </button>
        </div>

        {/* Breadcrumb selectors */}
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F9F8F4] text-[#2C2621] hover:bg-[#E2D4B7]/30 transition-colors">
            <span className="font-medium">Rancho Norte</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F9F8F4] text-[#2C2621] hover:bg-[#E2D4B7]/30 transition-colors">
            <span className="font-medium">{selectedArea}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      {isMobile ? (
        <MobileDashboard historicalData={historicalData} />
      ) : (
        <DesktopDashboard historicalData={historicalData} />
      )}
    </div>
  );
}

function DesktopDashboard({ historicalData }: { historicalData: any[] }) {
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
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - currentReadings.soilHumidity / 100)}`}
                strokeLinecap="round"
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
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1 text-[#A68A61]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span className="text-sm">+0.3 vs ayer</span>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Irrigation Status (Row 2) */}
      <div className="col-span-4">
        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg text-[#2C2621]">Estado del Riego</h3>
            <div className="w-3 h-3 rounded-full bg-[#6D7E5E] animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#6E6359]">Estado</span>
              <span className="font-bold text-[#6D7E5E]">ACTIVO</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6359]">Tiempo transcurrido</span>
              <span className="font-bold text-[#2C2621]">{currentReadings.irrigationElapsedTime}</span>
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
              <p className="text-2xl font-bold text-[#2C2621]">{currentReadings.soilConductivity} <span className="text-base text-[#6E6359]">dS/m</span></p>
            </div>
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Temperatura</p>
              <p className="text-2xl font-bold text-[#2C2621]">{currentReadings.soilTemp} <span className="text-base text-[#6E6359]">°C</span></p>
            </div>
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Potencial hídrico</p>
              <p className="text-2xl font-bold text-[#2C2621]">{currentReadings.waterPotential} <span className="text-base text-[#6E6359]">MPa</span></p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Chart (Row 3) */}
      <div className="col-span-8 row-span-2">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[#2C2621] mb-6">Humedad del Suelo - Últimas 24 horas</h3>
          <div className="h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6D7E5E" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6D7E5E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" />
                <XAxis 
                  dataKey="time" 
                  stroke="#6E6359"
                  style={{ fontSize: '12px' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="#6E6359"
                  style={{ fontSize: '12px' }}
                  domain={[30, 60]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#F9F8F4', 
                    border: '1px solid #E6E1D8',
                    borderRadius: '16px',
                    padding: '12px'
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
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[24px] bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Sun className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Temperatura aire</p>
                  <p className="font-bold text-[#2C2621]">{currentReadings.airTemp} °C</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-[24px] bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Droplets className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Humedad relativa</p>
                  <p className="font-bold text-[#2C2621]">{currentReadings.relativeHumidity} %</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[24px] bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Wind className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Viento</p>
                  <p className="font-bold text-[#2C2621]">{currentReadings.windSpeed} km/h</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[24px] bg-[#F4F1EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                  <Zap className="w-5 h-5 text-[#6D7E5E]" />
                </div>
                <div>
                  <p className="text-sm text-[#6E6359]">Radiación solar</p>
                  <p className="font-bold text-[#2C2621]">{currentReadings.solarRadiation} W/m²</p>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}

function MobileDashboard({ historicalData }: { historicalData: any[] }) {
  return (
    <div className="space-y-4">
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
      />

      {/* Chart */}
      <BentoCard variant="light">
        <h3 className="text-lg text-[#2C2621] mb-4">Últimas 24 horas</h3>
        <div className="h-[200px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6D7E5E" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6D7E5E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                stroke="#6E6359"
                style={{ fontSize: '10px' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#6E6359"
                style={{ fontSize: '10px' }}
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
          <div className="w-3 h-3 rounded-full bg-[#6D7E5E] animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Estado</span>
            <span className="font-bold text-[#6D7E5E]">ACTIVO</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Tiempo transcurrido</span>
            <span className="font-bold text-[#2C2621]">{currentReadings.irrigationElapsedTime}</span>
          </div>
        </div>
      </BentoCard>

      {/* Horizontal scroll cards for secondary metrics */}
      <div>
        <h3 className="text-lg text-[#2C2621] mb-3">Métricas de Suelo</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[#6E6359] mb-1">Conductividad</p>
            <p className="text-2xl font-bold text-[#2C2621]">{currentReadings.soilConductivity} <span className="text-base text-[#6E6359]">dS/m</span></p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[#6E6359] mb-1">Temperatura</p>
            <p className="text-2xl font-bold text-[#2C2621]">{currentReadings.soilTemp} <span className="text-base text-[#6E6359]">°C</span></p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[#6E6359] mb-1">Potencial hídrico</p>
            <p className="text-2xl font-bold text-[#2C2621]">{currentReadings.waterPotential} <span className="text-base text-[#6E6359]">MPa</span></p>
          </BentoCard>
        </div>
      </div>

      {/* Environmental */}
      <BentoCard variant="light">
        <h3 className="text-lg text-[#2C2621] mb-4">Ambiental</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Temperatura aire</span>
            <span className="font-bold text-[#2C2621]">{currentReadings.airTemp} °C</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Humedad relativa</span>
            <span className="font-bold text-[#2C2621]">{currentReadings.relativeHumidity} %</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Viento</span>
            <span className="font-bold text-[#2C2621]">{currentReadings.windSpeed} km/h</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6E6359]">Radiación solar</span>
            <span className="font-bold text-[#2C2621]">{currentReadings.solarRadiation} W/m²</span>
          </div>
        </div>
      </BentoCard>
    </div>
  );
}