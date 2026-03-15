import { useState, useEffect } from "react";
import { Users, MapPin, Radio, Database, AlertCircle, Plus } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { Link } from "react-router"; // or react-router-dom depending on your setup
import { api } from "../../services/api";

export function AdminDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    properties: 0,
    nodesTotal: 0,
    nodesActive: 0,
    readingsToday: 0
  });
  const [offlineNodes, setOfflineNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Parallel requests for all counts
        const [clientsRes, propsRes, nodesRes, readingsRes] = await Promise.all([
          api.get("/clients?per_page=1"),
          api.get("/properties?per_page=1"),
          api.get("/nodes?per_page=200"), // Get more nodes to find inactive ones
          api.get(`/readings?per_page=1&start_date=${new Date().toISOString().split('T')[0]}`)
        ]);

        const totalClients = clientsRes.data.total || 0;
        const totalProps = propsRes.data.total || 0;
        const totalReadings = readingsRes.data.total || 0;
        
        const nodesData = nodesRes.data.data || nodesRes.data || [];
        const totalNodes = nodesRes.data.total || nodesData.length || 0;
        const activeNodes = nodesData.filter((n: any) => n.is_active || n.activo).length;
        const inactiveNodes = nodesData.filter((n: any) => !(n.is_active || n.activo));

        setStats({
          clients: totalClients,
          properties: totalProps,
          nodesTotal: totalNodes,
          nodesActive: activeNodes,
          readingsToday: totalReadings
        });
        
        setOfflineNodes(inactiveNodes);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Panel de Administración</h1>
        <p className="text-[#6E6359]">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading ? (
         <div className="flex justify-center items-center py-12">
            <p className="text-[#6E6359]">Cargando métricas...</p>
         </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
                  <Users className="w-6 h-6 text-[#F4F1EB]" />
                </div>
              </div>
              <p className="text-sm text-[#6E6359] mb-1">Total Clientes</p>
              <p className="text-3xl font-bold text-[#2C2621]">{stats.clients}</p>
            </BentoCard>

            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
                  <MapPin className="w-6 h-6 text-[#F4F1EB]" />
                </div>
              </div>
              <p className="text-sm text-[#6E6359] mb-1">Total Predios</p>
              <p className="text-3xl font-bold text-[#2C2621]">{stats.properties}</p>
            </BentoCard>

            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
                  <Radio className="w-6 h-6 text-[#F4F1EB]" />
                </div>
              </div>
              <p className="text-sm text-[#6E6359] mb-1">Nodos Activos</p>
              <p className="text-3xl font-bold text-[#2C2621]">
                {stats.nodesActive}/{stats.nodesTotal}
              </p>
            </BentoCard>

            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
                  <Database className="w-6 h-6 text-[#F4F1EB]" />
                </div>
              </div>
              <p className="text-sm text-[#6E6359] mb-1">Lecturas Hoy</p>
              <p className="text-3xl font-bold text-[#2C2621]">
                {stats.readingsToday.toLocaleString()}
              </p>
            </BentoCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alerts section */}
            <div className="lg:col-span-2">
              <BentoCard variant="light">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg text-[#2C2621]">Nodos Inactivos / Sin Comunicación</h3>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DC2626]/10">
                    <AlertCircle className="w-4 h-4 text-[#DC2626]" />
                    <span className="text-sm font-medium text-[#DC2626]">{offlineNodes.length}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {offlineNodes.map((node) => (
                    <div key={node.id} className="p-4 rounded-[24px] bg-[#F4F1EB] border-l-4 border-[#DC2626]">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-[#2C2621]">{node.name || `Nodo #${node.id}`}</h4>
                          <p className="text-sm text-[#6E6359]">Serial: {node.serial_number || '-'}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-[#DC2626]/10 text-[#DC2626] text-xs font-medium">
                          Sin conexión / Inactivo
                        </span>
                      </div>
                    </div>
                  ))}
                  {offlineNodes.length === 0 && (
                    <p className="text-sm text-[#6E6359]">Todos los nodos registrados están activos y operando correctamente.</p>
                  )}
                </div>
              </BentoCard>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="space-y-6">
              <BentoCard variant="light">
                <h3 className="text-lg text-[#2C2621] mb-6">Acciones Rápidas</h3>
                <div className="space-y-3">
                  <Link to="/admin/clientes" className="block">
                    <PillButton variant="primary" className="w-full justify-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Cliente
                    </PillButton>
                  </Link>
                  <Link to="/admin/predios" className="block">
                    <PillButton variant="secondary" className="w-full justify-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Predio
                    </PillButton>
                  </Link>
                  <Link to="/admin/nodos" className="block">
                    <PillButton variant="secondary" className="w-full justify-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Nodo
                    </PillButton>
                  </Link>
                </div>
              </BentoCard>

              {/* Recent activity is mocked for now as MVP doesn't have an audit log yet */}
              <BentoCard variant="sand">
                <h3 className="text-lg text-[#2C2621] mb-4">Actividad Reciente</h3>
                <div className="space-y-3">
                  <p className="text-sm text-[#6E6359] italic">
                    El registro de actividad estará disponible en la próxima versión.
                  </p>
                </div>
              </BentoCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
