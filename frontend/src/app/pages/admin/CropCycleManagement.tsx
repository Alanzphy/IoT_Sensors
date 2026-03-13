import { useState } from "react";
import { Plus, Calendar } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { cropCycles, irrigationAreas } from "../../data/mockData";

export function CropCycleManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Gestión de Ciclos de Cultivo</h1>
          <p className="text-[#6E6359]">Administra los ciclos de cultivo por área</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ciclo
        </PillButton>
      </div>

      {/* Timeline view */}
      <div className="space-y-6">
        {irrigationAreas.map((area) => {
          const areaCycles = cropCycles.filter(c => c.areaId === area.id);

          return (
            <BentoCard key={area.id} variant="light">
              <h3 className="text-lg text-[#2C2621] mb-4">{area.name}</h3>
              
              <div className="space-y-3">
                {areaCycles.map((cycle) => (
                  <div 
                    key={cycle.id} 
                    className={`p-4 rounded-[24px] ${
                      cycle.isActive 
                        ? "bg-[#6D7E5E]/10 border-2 border-[#6D7E5E]" 
                        : "bg-[#F4F1EB]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-[#6E6359]" />
                        <div>
                          <p className="font-medium text-[#2C2621]">
                            {new Date(cycle.startDate).toLocaleDateString('es-MX', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                            {' → '}
                            {cycle.endDate 
                              ? new Date(cycle.endDate).toLocaleDateString('es-MX', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })
                              : 'Actual'
                            }
                          </p>
                          <p className="text-sm text-[#6E6359]">
                            {cycle.endDate 
                              ? `Duración: ${Math.floor((new Date(cycle.endDate).getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24))} días`
                              : `En curso: ${Math.floor((Date.now() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24))} días`
                            }
                          </p>
                        </div>
                      </div>
                      {cycle.isActive && (
                        <span className="px-3 py-1 rounded-full bg-[#6D7E5E] text-[#F4F1EB] text-xs font-medium">
                          Activo
                        </span>
                      )}
                    </div>

                    {/* Progress bar for active cycles */}
                    {cycle.isActive && (
                      <div className="mt-3">
                        <div className="h-2 bg-[#E6E1D8] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#6D7E5E] rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(
                                (Math.floor((Date.now() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24)) / 365) * 100, 
                                100
                              )}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </BentoCard>
          );
        })}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Ciclo de Cultivo</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Área de Riego</label>
                <select className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]">
                  <option value="">Seleccionar área</option>
                  {irrigationAreas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Fecha de Inicio</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Fecha de Fin (opcional)</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
                <p className="text-xs text-[#6E6359] mt-1">Dejar vacío para ciclo activo sin fecha de fin</p>
              </div>

              <div className="bg-[#D97706]/10 p-4 rounded-[20px]">
                <p className="text-sm text-[#2C2621]">
                  ⚠️ Solo puede haber un ciclo activo por área. Al crear un nuevo ciclo activo, se finalizará el ciclo anterior automáticamente.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1">
                  Crear Ciclo
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
