import { useState } from "react";
import { Plus, Eye, EyeOff, Copy, Search, ChevronRight } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { nodes } from "../../data/mockData";
import { Link } from "react-router";

export function NodeManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});

  const toggleApiKeyVisibility = (nodeId: string) => {
    setVisibleApiKeys(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // In a real app, show a toast notification
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Gestión de Nodos</h1>
          <p className="text-[#6E6359]">Administra los sensores IoT del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Nodo
        </PillButton>
      </div>

      {/* Search */}
      <BentoCard variant="light" className="mb-6">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-[#6E6359]" />
          <input
            type="text"
            placeholder="Buscar por nombre, serial o área vinculada..."
            className="flex-1 bg-transparent text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none"
          />
        </div>
      </BentoCard>

      {/* Desktop table */}
      <div className="hidden md:block">
        <BentoCard variant="light">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2C2621]/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Nombre</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Serial</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">API Key</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Área Vinculada</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">GPS</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Última Lectura</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node, i) => (
                  <tr key={node.id} className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}>
                    <td className="py-4 px-4">
                      <Link to={`/admin/nodos/${node.id}`} className="font-medium text-[#2C2621] hover:text-[#6D7E5E]">
                        {node.name}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#6E6359] font-mono">{node.serialNumber}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#6E6359] font-mono">
                          {visibleApiKeys[node.id] 
                            ? node.apiKey 
                            : '••••••••••••••••'
                          }
                        </span>
                        <button 
                          onClick={() => toggleApiKeyVisibility(node.id)}
                          className="p-1 rounded hover:bg-[#E2D4B7]/50 transition-colors"
                        >
                          {visibleApiKeys[node.id] ? (
                            <EyeOff className="w-4 h-4 text-[#6E6359]" />
                          ) : (
                            <Eye className="w-4 h-4 text-[#6E6359]" />
                          )}
                        </button>
                        <button 
                          onClick={() => copyToClipboard(node.apiKey)}
                          className="p-1 rounded hover:bg-[#E2D4B7]/50 transition-colors"
                        >
                          <Copy className="w-4 h-4 text-[#6E6359]" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#2C2621]">
                      {node.linkedArea || (
                        <span className="text-[#6E6359] italic">Sin vincular</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-[#6E6359] font-mono">
                      {node.gpsLat}, {node.gpsLng}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-2 h-2 rounded-full ${
                            node.status === "active" ? "bg-[#6D7E5E]" : "bg-[#DC2626]"
                          }`}
                        />
                        <span className="text-sm text-[#2C2621]">
                          {node.status === "active" ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <FreshnessIndicator lastUpdate={node.lastReading} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {nodes.map((node) => (
          <Link key={node.id} to={`/admin/nodos/${node.id}`}>
            <BentoCard variant="light">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-[#2C2621] mb-1">{node.name}</h3>
                  <p className="text-sm text-[#6E6359] font-mono">{node.serialNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      node.status === "active" ? "bg-[#6D7E5E]" : "bg-[#DC2626]"
                    }`}
                  />
                  <ChevronRight className="w-5 h-5 text-[#6E6359]" />
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#6E6359]">Área vinculada</span>
                  <span className="text-[#2C2621]">
                    {node.linkedArea || <span className="italic text-[#6E6359]">Sin vincular</span>}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <FreshnessIndicator lastUpdate={node.lastReading} />
              </div>
            </BentoCard>
          </Link>
        ))}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <BentoCard variant="light" className="w-full max-w-md my-8">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Nodo Sensor</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Nombre del Nodo</label>
                <input
                  type="text"
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Número de Serie</label>
                <input
                  type="text"
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">API Key (generado automáticamente)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={"ak_live_" + Math.random().toString(36).substring(2, 18)}
                    readOnly
                    className="flex-1 px-4 py-2.5 rounded-[24px] bg-[#E2D4B7] border border-[#2C2621]/10 text-[#2C2621] font-mono text-sm"
                  />
                  <button 
                    type="button"
                    className="p-2.5 rounded-full bg-[#6D7E5E] text-[#F4F1EB] hover:opacity-90 transition-opacity"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#6E6359] mb-2">Latitud GPS</label>
                  <input
                    type="text"
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6E6359] mb-2">Longitud GPS</label>
                  <input
                    type="text"
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Vincular a Área de Riego (opcional)</label>
                <select className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]">
                  <option value="">Sin vincular</option>
                  <option value="1">Nogal Norte</option>
                  <option value="2">Alfalfa Este</option>
                  <option value="3">Manzanar Oeste</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1">
                  Crear Nodo
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
