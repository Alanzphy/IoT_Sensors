import { useState } from "react";
import { Plus, Search, Edit, XCircle, ChevronRight } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { clients } from "../../data/mockData";
import { Link } from "react-router";

export function ClientManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Gestión de Clientes</h1>
          <p className="text-[#6E6359]">Administra los clientes del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </PillButton>
      </div>

      {/* Search bar */}
      <BentoCard variant="light" className="mb-6">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-[#6E6359]" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none"
          />
        </div>
      </BentoCard>

      {/* Desktop table view */}
      <div className="hidden md:block">
        <BentoCard variant="light">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2C2621]/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Empresa</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Teléfono</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Predios</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Nodos</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => (
                  <tr 
                    key={client.id}
                    className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}
                  >
                    <td className="py-4 px-4">
                      <Link to={`/admin/clientes/${client.id}/predios`} className="font-medium text-[#2C2621] hover:text-[#6D7E5E]">
                        {client.name}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#6E6359]">{client.email}</td>
                    <td className="py-4 px-4 text-sm text-[#6E6359]">{client.phone}</td>
                    <td className="py-4 px-4 text-sm text-[#2C2621] font-medium">{client.properties}</td>
                    <td className="py-4 px-4 text-sm text-[#2C2621] font-medium">{client.nodes}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        client.status === "active" 
                          ? "bg-[#6D7E5E]/10 text-[#6D7E5E]" 
                          : "bg-[#6E6359]/10 text-[#6E6359]"
                      }`}>
                        {client.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors">
                          <Edit className="w-4 h-4 text-[#6E6359]" />
                        </button>
                        <button className="p-2 rounded-full hover:bg-[#DC2626]/10 transition-colors">
                          <XCircle className="w-4 h-4 text-[#DC2626]" />
                        </button>
                      </div>
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
        {clients.map((client) => (
          <Link key={client.id} to={`/admin/clientes/${client.id}/predios`}>
            <BentoCard variant="light">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-[#2C2621] mb-1">{client.name}</h3>
                  <p className="text-sm text-[#6E6359]">{client.email}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6E6359]" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[#6E6359]">Predios</p>
                  <p className="font-medium text-[#2C2621]">{client.properties}</p>
                </div>
                <div>
                  <p className="text-[#6E6359]">Nodos</p>
                  <p className="font-medium text-[#2C2621]">{client.nodes}</p>
                </div>
              </div>
              <div className="mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  client.status === "active" 
                    ? "bg-[#6D7E5E]/10 text-[#6D7E5E]" 
                    : "bg-[#6E6359]/10 text-[#6E6359]"
                }`}>
                  {client.status === "active" ? "Activo" : "Inactivo"}
                </span>
              </div>
            </BentoCard>
          </Link>
        ))}
      </div>

      {/* Create form drawer (simplified) */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Cliente</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Nombre de la Empresa</label>
                <input
                  type="text"
                  placeholder="Ej: Agrícola López"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Email</label>
                <input
                  type="email"
                  placeholder="contacto@ejemplo.mx"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Teléfono</label>
                <input
                  type="tel"
                  placeholder="+52 656 123 4567"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1">
                  Crear Cliente
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
