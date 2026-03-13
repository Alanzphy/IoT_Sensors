import { useParams, Link } from "react-router";
import { MapPin, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { MetricCard } from "../../components/MetricCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { nodes, currentReadings, generateHistoricalData } from "../../data/mockData";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function NodeDetail() {
  const { nodeId } = useParams();
  const node = nodes.find(n => n.id === nodeId);
  const [showApiKey, setShowApiKey] = useState(false);
  const historicalData = generateHistoricalData();

  if (!node) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <BentoCard variant="light">
          <p className="text-[#6E6359]">Nodo no encontrado</p>
        </BentoCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[#6E6359] mb-2">
          <Link to="/admin/nodos" className="hover:text-[#6D7E5E]">Nodos</Link>
          <span>/</span>
          <span>{node.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">{node.name}</h1>
            <p className="text-[#6E6359] font-mono">{node.serialNumber}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${
            node.status === "active" 
              ? "bg-[#6D7E5E] text-[#F4F1EB]" 
              : "bg-[#DC2626] text-white"
          }`}>
            {node.status === "active" ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Node info */}
        <BentoCard variant="light">
          <h3 className="text-lg text-[#2C2621] mb-4">Información del Nodo</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Área Vinculada</p>
              <p className="font-medium text-[#2C2621]">
                {node.linkedArea || <span className="italic text-[#6E6359]">Sin vincular</span>}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-[#6E6359] mb-1">Coordenadas GPS</p>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#6E6359]" />
                <p className="font-mono text-sm text-[#2C2621]">
                  {node.gpsLat}, {node.gpsLng}
                </p>
              </div>
            </div>

            <div>
              <FreshnessIndicator lastUpdate={node.lastReading} />
            </div>
          </div>
        </BentoCard>

        {/* API Key */}
        <div className="lg:col-span-2">
          <BentoCard variant="sand">
            <h3 className="text-lg text-[#2C2621] mb-4">API Key (Solo Admin)</h3>
            <div className="bg-[#F4F1EB] p-4 rounded-[24px]">
              <div className="flex items-center gap-3 mb-2">
                <code className="flex-1 font-mono text-sm text-[#2C2621] break-all">
                  {showApiKey ? node.apiKey : '••••••••••••••••••••••••••••'}
                </code>
                <button 
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors flex-shrink-0"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4 text-[#6E6359]" />
                  ) : (
                    <Eye className="w-4 h-4 text-[#6E6359]" />
                  )}
                </button>
                <button 
                  onClick={() => navigator.clipboard.writeText(node.apiKey)}
                  className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors flex-shrink-0"
                >
                  <Copy className="w-4 h-4 text-[#6E6359]" />
                </button>
              </div>
              <p className="text-xs text-[#6E6359]">
                Usar esta clave para autenticar las solicitudes del sensor IoT
              </p>
            </div>
          </BentoCard>
        </div>
      </div>

      {/* Real-time data - same as client dashboard but for specific node */}
      <div className="mb-4">
        <h2 className="text-xl text-[#2C2621] mb-4">Datos en Tiempo Real</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Humedad del Suelo"
          value={currentReadings.soilHumidity}
          unit="%"
          variant="dark"
          lastUpdate={node.lastReading}
        />

        <MetricCard
          title="Flujo de Agua"
          value={currentReadings.waterFlow}
          unit="L/min"
          variant="dark"
          lastUpdate={node.lastReading}
        />

        <MetricCard
          title="E.T.O."
          value={currentReadings.eto}
          unit="mm/día"
          variant="dark"
          lastUpdate={node.lastReading}
        />
      </div>

      {/* Chart */}
      <BentoCard variant="light">
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
      </BentoCard>
    </div>
  );
}