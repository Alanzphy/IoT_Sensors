import { Users, MapPin, Radio, Database, AlertCircle, Plus } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { clients, nodes } from "../../data/mockData";

export function AdminDashboard() {
  const totalReadings = 15432;
  const offlineNodes = nodes.filter(n => n.status === "inactive");

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Panel de Administración</h1>
        <p className="text-[#6E6359]">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
              <Users className="w-6 h-6 text-[#F4F1EB]" />
            </div>
          </div>
          <p className="text-sm text-[#6E6359] mb-1">Total Clientes</p>
          <p className="text-3xl font-bold text-[#2C2621]">{clients.length}</p>
        </BentoCard>

        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
              <MapPin className="w-6 h-6 text-[#F4F1EB]" />
            </div>
          </div>
          <p className="text-sm text-[#6E6359] mb-1">Total Predios</p>
          <p className="text-3xl font-bold text-[#2C2621]">6</p>
        </BentoCard>

        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
              <Radio className="w-6 h-6 text-[#F4F1EB]" />
            </div>
          </div>
          <p className="text-sm text-[#6E6359] mb-1">Nodos Activos</p>
          <p className="text-3xl font-bold text-[#2C2621]">
            {nodes.filter(n => n.status === "active").length}/{nodes.length}
          </p>
        </BentoCard>

        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-[24px] bg-[#6D7E5E]">
              <Database className="w-6 h-6 text-[#F4F1EB]" />
            </div>
          </div>
          <p className="text-sm text-[#6E6359] mb-1">Lecturas Hoy</p>
          <p className="text-3xl font-bold text-[#2C2621]">{totalReadings.toLocaleString()}</p>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts section */}
        <div className="lg:col-span-2">
          <BentoCard variant="light">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg text-[#2C2621]">Alertas y Nodos Sin Comunicación</h3>
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
                      <h4 className="font-medium text-[#2C2621]">{node.name}</h4>
                      <p className="text-sm text-[#6E6359]">Serial: {node.serialNumber}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#DC2626]/10 text-[#DC2626] text-xs font-medium">
                      Sin conexión
                    </span>
                  </div>
                  <FreshnessIndicator lastUpdate={node.lastReading} />
                  <p className="text-sm text-[#6E6359] mt-2">
                    Sugerencia: Verificar alimentación y conexión de red
                  </p>
                </div>
              ))}

              {nodes.filter(n => n.status === "active").slice(0, 2).map((node) => {
                const minutesAgo = Math.floor((Date.now() - node.lastReading.getTime()) / (1000 * 60));
                if (minutesAgo < 30) return null;

                return (
                  <div key={node.id} className="p-4 rounded-[24px] bg-[#F4F1EB] border-l-4 border-[#D97706]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-[#2C2621]">{node.name}</h4>
                        <p className="text-sm text-[#6E6359]">Serial: {node.serialNumber}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#D97706]/10 text-[#D97706] text-xs font-medium">
                        Advertencia
                      </span>
                    </div>
                    <FreshnessIndicator lastUpdate={node.lastReading} />
                  </div>
                );
              })}
            </div>
          </BentoCard>
        </div>

        {/* Quick actions */}
        <div>
          <BentoCard variant="light">
            <h3 className="text-lg text-[#2C2621] mb-6">Acciones Rápidas</h3>
            <div className="space-y-3">
              <PillButton variant="primary" className="w-full justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Cliente
              </PillButton>
              <PillButton variant="secondary" className="w-full justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Predio
              </PillButton>
              <PillButton variant="secondary" className="w-full justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Nodo
              </PillButton>
            </div>
          </BentoCard>

          {/* Recent activity */}
          <BentoCard variant="sand" className="mt-6">
            <h3 className="text-lg text-[#2C2621] mb-4">Actividad Reciente</h3>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="text-[#2C2621] font-medium">Cliente agregado</p>
                <p className="text-[#6E6359]">Agrícola López - hace 2 días</p>
              </div>
              <div className="text-sm">
                <p className="text-[#2C2621] font-medium">Nodo vinculado</p>
                <p className="text-[#6E6359]">Sensor Nogal-01 - hace 3 días</p>
              </div>
              <div className="text-sm">
                <p className="text-[#2C2621] font-medium">Área creada</p>
                <p className="text-[#6E6359]">Maíz Sur - hace 5 días</p>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}
