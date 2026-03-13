import { useState } from "react";
import { Plus, ChevronRight, Edit } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { properties } from "../../data/mockData";
import { Link, useParams } from "react-router";

export function PropertyManagement() {
  const { clientId } = useParams();
  const clientProperties = properties.filter(p => p.clientId === clientId);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[#6E6359] mb-2">
          <Link to="/admin/clientes" className="hover:text-[#6D7E5E]">Clientes</Link>
          <span>/</span>
          <span>Agrícola López</span>
          <span>/</span>
          <span>Predios</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl text-[#2C2621]">Predios</h1>
          <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Predio
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
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Ubicación</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Áreas de Riego</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Fecha Creación</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientProperties.map((property, i) => (
                <tr key={property.id} className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}>
                  <td className="py-4 px-4">
                    <Link 
                      to={`/admin/predios/${property.id}/areas`}
                      className="font-medium text-[#2C2621] hover:text-[#6D7E5E]"
                    >
                      {property.name}
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-sm text-[#6E6359]">{property.location}</td>
                  <td className="py-4 px-4 text-sm text-[#2C2621] font-medium">{property.areas}</td>
                  <td className="py-4 px-4 text-sm text-[#6E6359]">
                    {new Date(property.createdDate).toLocaleDateString('es-MX', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </td>
                  <td className="py-4 px-4">
                    <button className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors">
                      <Edit className="w-4 h-4 text-[#6E6359]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BentoCard>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {clientProperties.map((property) => (
          <Link key={property.id} to={`/admin/predios/${property.id}/areas`}>
            <BentoCard variant="light">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-[#2C2621] mb-1">{property.name}</h3>
                  <p className="text-sm text-[#6E6359]">{property.location}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6E6359]" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6E6359]">Áreas de riego</span>
                <span className="font-medium text-[#2C2621]">{property.areas}</span>
              </div>
            </BentoCard>
          </Link>
        ))}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Predio</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Nombre del Predio</label>
                <input
                  type="text"
                  placeholder="Ej: Rancho Norte"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Ubicación</label>
                <input
                  type="text"
                  placeholder="Ej: Chihuahua, Chih."
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1">
                  Crear Predio
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
