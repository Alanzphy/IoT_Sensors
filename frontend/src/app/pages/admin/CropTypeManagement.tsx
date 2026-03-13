import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { cropIcons } from "../../components/icons/CropIcons";
import { cropTypes } from "../../data/mockData";

export function CropTypeManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Catálogo de Cultivos</h1>
          <p className="text-[#6E6359]">Gestiona los tipos de cultivo disponibles</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cultivo
        </PillButton>
      </div>

      {/* Desktop grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cropTypes.map((crop) => {
          const CropIcon = cropIcons[crop.id];
          const usageCount = Math.floor(Math.random() * 5) + 1; // Mock usage count

          return (
            <BentoCard key={crop.id} variant="light">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-[24px] bg-[#E2D4B7]">
                    <CropIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[#2C2621]">{crop.name}</h3>
                    <p className="text-sm text-[#6E6359]">{usageCount} área{usageCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors">
                    <Edit className="w-4 h-4 text-[#6E6359]" />
                  </button>
                  <button 
                    className="p-2 rounded-full hover:bg-[#DC2626]/10 transition-colors"
                    disabled={usageCount > 0}
                  >
                    <Trash2 className={`w-4 h-4 ${usageCount > 0 ? 'text-[#6E6359]/30' : 'text-[#DC2626]'}`} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[#6E6359]">{crop.description}</p>
              {usageCount > 0 && (
                <p className="text-xs text-[#6E6359] mt-3 italic">
                  No se puede eliminar: en uso por {usageCount} área{usageCount !== 1 ? 's' : ''}
                </p>
              )}
            </BentoCard>
          );
        })}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Tipo de Cultivo</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Nombre del Cultivo</label>
                <input
                  type="text"
                  placeholder="Ej: Nogal"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Descripción</label>
                <textarea
                  rows={3}
                  placeholder="Ej: Nogal pecanero"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1">
                  Crear Cultivo
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
