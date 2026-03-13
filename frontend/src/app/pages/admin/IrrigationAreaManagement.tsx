import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { cropIcons } from "../../components/icons/CropIcons";
import { irrigationAreas, cropTypes } from "../../data/mockData";
import { Link, useParams } from "react-router";

export function IrrigationAreaManagement() {
  const { predioId } = useParams();
  const areas = irrigationAreas.filter(a => a.predioId === predioId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCropType, setSelectedCropType] = useState("");

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[#6E6359] mb-2">
          <Link to="/admin/clientes" className="hover:text-[#6D7E5E]">Clientes</Link>
          <span>/</span>
          <Link to="/admin/clientes/1/predios" className="hover:text-[#6D7E5E]">Agrícola López</Link>
          <span>/</span>
          <span>Rancho Norte</span>
          <span>/</span>
          <span>Áreas de Riego</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl text-[#2C2621]">Áreas de Riego</h1>
          <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Área
          </PillButton>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <BentoCard variant="light">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2C2621]/10">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Nombre</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Cultivo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Tamaño (ha)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Nodo Vinculado</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Ciclo Activo</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area, i) => {
                const CropIcon = cropIcons[area.cropType];
                const cropType = cropTypes.find(c => c.id === area.cropType);

                return (
                  <tr key={area.id} className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}>
                    <td className="py-4 px-4 font-medium text-[#2C2621]">{area.name}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-[16px] bg-[#E2D4B7]">
                          <CropIcon className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-[#2C2621]">{cropType?.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#2C2621] font-medium">{area.size}</td>
                    <td className="py-4 px-4 text-sm text-[#6E6359]">{area.nodeId || "Sin vincular"}</td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 rounded-full bg-[#6D7E5E]/10 text-[#6D7E5E] text-xs font-medium">
                        Activo
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BentoCard>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {areas.map((area) => {
          const CropIcon = cropIcons[area.cropType];
          const cropType = cropTypes.find(c => c.id === area.cropType);

          return (
            <BentoCard key={area.id} variant="light">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 rounded-[24px] bg-[#E2D4B7]">
                  <CropIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#2C2621]">{area.name}</h3>
                  <p className="text-sm text-[#6E6359]">{cropType?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[#6E6359]">Tamaño</p>
                  <p className="font-medium text-[#2C2621]">{area.size} ha</p>
                </div>
                <div>
                  <p className="text-[#6E6359]">Nodo</p>
                  <p className="font-medium text-[#2C2621]">{area.nodeId || "Sin vincular"}</p>
                </div>
              </div>
            </BentoCard>
          );
        })}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[#2C2621] mb-6">Nueva Área de Riego</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Nombre del Área</label>
                <input
                  type="text"
                  placeholder="Ej: Nogal Norte"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Tipo de Cultivo</label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                  >
                    <span>{selectedCropType || "Seleccionar cultivo"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Crop type options with icons */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {cropTypes.map((crop) => {
                    const CropIcon = cropIcons[crop.id];
                    return (
                      <button
                        key={crop.id}
                        type="button"
                        onClick={() => setSelectedCropType(crop.name)}
                        className={`flex items-center gap-2 p-3 rounded-[20px] transition-all ${
                          selectedCropType === crop.name
                            ? "bg-[#6D7E5E] text-[#F4F1EB]"
                            : "bg-[#F4F1EB] text-[#2C2621] hover:bg-[#E2D4B7]"
                        }`}
                      >
                        <CropIcon className="w-5 h-5" />
                        <span className="text-sm font-medium">{crop.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Tamaño (hectáreas)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="12.5"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1">
                  Crear Área
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
