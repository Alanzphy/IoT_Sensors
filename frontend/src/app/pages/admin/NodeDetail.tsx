import { Copy, Eye, EyeOff, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { MetricCard } from "../../components/MetricCard";
import { api } from "../../services/api";

export function NodeDetail() {
  const { nodeId } = useParams();

  const [node, setNode] = useState<any>(null);
  const [area, setArea] = useState<any>(null);
  const [latestReading, setLatestReading] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNodeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Node
        const nodeRes = await api.get(`/nodes/${nodeId}`);
        const nodeData = nodeRes.data.data || nodeRes.data;
        setNode(nodeData);

        // 2. Fetch Area if linked
        if (nodeData.irrigation_area_id) {
          try {
            const areaRes = await api.get(`/irrigation-areas/${nodeData.irrigation_area_id}`);
            setArea(areaRes.data.data || areaRes.data);
          } catch (e) {
            console.error("Area fetching error", e);
          }

          // 3. Fetch latest reading
          try {
            const latestRes = await api.get`/readings/latest?irrigation_area_id=${nodeData.irrigation_area_id}`;
            setLatestReading(latestRes.data.data || latestRes.data);
          } catch (e) {
            console.error("Latest reading error", e);
          }

          // 4. Fetch historical for chart (last 24 periods ~ 144 points for 10 min intervals)
          try {
            const histRes = await api.get(`/readings?irrigation_area_id=${nodeData.irrigation_area_id}&per_page=144`);
            const readings = histRes.data.data || histRes.data || [];

            // Sort ascending by time
            const sorted = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const chartData = sorted.map((r: any) => ({
              time: new Date(r.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              soilHumidity: r.soil?.humidity || 0
            }));

            setHistoricalData(chartData);
          } catch (e) {
             console.error("Historical data error", e);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Error al cargar información del nodo.");
      } finally {
        setLoading(false);
      }
    };

    if (nodeId) {
      fetchNodeData();
    }
  }, [nodeId]);

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <p className="text-[#6E6359]">Cargando nodo...</p>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <BentoCard variant="light">
          <p className="text-[#DC2626] font-medium">{error || "Nodo no encontrado"}</p>
          <Link to="/admin/nodos" className="text-[#6D7E5E] underline mt-4 block">Volver a nodos</Link>
        </BentoCard>
      </div>
    );
  }

  const isNodeActive = node.is_active || node.activo;
  const lastUpdateStr = latestReading ? latestReading.timestamp : null;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[#6E6359] mb-2">
          <Link to="/admin/nodos" className="hover:text-[#6D7E5E]">Nodos</Link>
          <span>/</span>
          <span>{node.name || `Nodo #${node.id}`}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">{node.name || `Nodo #${node.id}`}</h1>
            <p className="text-[#6E6359] font-mono">{node.serial_number || '-'}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${
            isNodeActive
              ? "bg-[#6D7E5E] text-[#F4F1EB]"
              : "bg-[#DC2626] text-white"
          }`}>
            {isNodeActive ? "Activo" : "Inactivo"}
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
                {area?.nombre || <span className="italic text-[#6E6359]">Sin vincular</span>}
              </p>
            </div>

            <div>
              <p className="text-sm text-[#6E6359] mb-1">Coordenadas GPS</p>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#6E6359]" />
                <p className="font-mono text-sm text-[#2C2621]">
                  {(node.latitude && node.longitude)
                    ? `${node.latitude}, ${node.longitude}`
                    : 'No configurado'
                  }
                </p>
              </div>
            </div>

            <div>
              <FreshnessIndicator lastUpdate={lastUpdateStr} />
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
                  {showApiKey ? node.api_key : '••••••••••••••••••••••••••••'}
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
                  onClick={() => navigator.clipboard.writeText(node.api_key)}
                  className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors flex-shrink-0"
                  title="Copiar API Key"
                >
                  <Copy className="w-4 h-4 text-[#6E6359]" />
                </button>
              </div>
              <p className="text-xs text-[#6E6359]">
                Usar esta clave para autenticar las solicitudes del sensor Módulo de Control.
              </p>
            </div>
          </BentoCard>
        </div>
      </div>

      {/* Real-time data */}
      <div className="mb-4">
        <h2 className="text-xl text-[#2C2621] mb-4">Datos en Tiempo Real</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Humedad del Suelo"
          value={latestReading?.soil?.humidity ?? 0}
          unit="%"
          variant="dark"
          lastUpdate={lastUpdateStr}
        />

        <MetricCard
          title="Flujo de Agua"
          value={latestReading?.irrigation?.flow_per_minute ?? 0}
          unit="L/min"
          variant="dark"
          lastUpdate={lastUpdateStr}
        />

        <MetricCard
          title="E.T.O."
          value={latestReading?.environmental?.eto ?? 0}
          unit="mm/día"
          variant="dark"
          lastUpdate={lastUpdateStr}
        />
      </div>

      {/* Chart */}
      <BentoCard variant="light">
        <h3 className="text-lg text-[#2C2621] mb-6">Humedad del Suelo - Últimas Lecturas</h3>
        <div className="h-[300px] min-h-[300px]">
          {historicalData.length > 0 ? (
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
                  domain={[30, 60]} // Adjust bounds automatically might be better but maintaining mock layout
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
          ) : (
            <div className="flex items-center justify-center h-full text-[#6E6359]">
              {latestReading ? "Cargando histórico..." : "Sin datos históricos registrados."}
            </div>
          )}
        </div>
      </BentoCard>
    </div>
  );
}
