import { ChevronRight, Plus, Search, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

interface Client {
  id: number;
  company_name: string;
  phone: string | null;
  address: string | null;
  user: {
    email: string;
    full_name: string;
    is_active: boolean;
  };
}

export function ClientManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    full_name: "",
    password: "",
    phone: "",
    address: "",
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients?per_page=100");
      setClients(res.data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error loading clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/clients", formData);
      setShowCreateForm(false);
      setFormData({
        company_name: "",
        email: "",
        full_name: "",
        password: "",
        phone: "",
        address: "",
      });
      fetchClients();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error creating client");
    }
  };

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(term) ||
      (c.user?.email || "").toLowerCase().includes(term) ||
      (c.phone || "").toLowerCase().includes(term)
    );
  });

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

      {error && <div className="text-red-500 mb-4">{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

      <div className="hidden md:block">
        <BentoCard variant="light">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2C2621]/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Empresa</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Contacto</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Teléfono</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Estado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#6E6359]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-4 text-center">Cargando...</td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-[#2C2621]/5 last:border-0 hover:bg-[#2C2621]/5 transition-colors">
                    <td className="py-3 px-4 text-[#2C2621]">{client.company_name}</td>
                    <td className="py-3 px-4 text-[#2C2621]">{client.user?.full_name || "-"}</td>
                    <td className="py-3 px-4 text-[#6E6359]">{client.user?.email || "-"}</td>
                    <td className="py-3 px-4 text-[#6E6359]">{client.phone || "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${client.user?.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {client.user?.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex justify-end gap-2">
                       <Link to={`/admin/clientes/${client.id}/predios`}>
                         <PillButton variant="outline" className="px-3 py-1 text-xs">Predios <ChevronRight className="w-3 h-3 ml-1" /></PillButton>
                       </Link>
                    </td>
                  </tr>
                ))}
                {!loading && filteredClients.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-[#6E6359]">No hay clientes registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading && <div className="text-center py-4">Cargando...</div>}
        {!loading && filteredClients.map((client) => (
          <BentoCard key={client.id} variant="light" className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[#2C2621] font-medium">{client.company_name}</h3>
                <p className="text-sm text-[#6E6359]">{client.user?.full_name}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${client.user?.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {client.user?.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="space-y-1 mb-4">
              <p className="text-sm text-[#6E6359]">{client.user?.email}</p>
              <p className="text-sm text-[#6E6359]">{client.phone || "Sin teléfono"}</p>
            </div>
            <div className="flex justify-end">
              <Link to={`/admin/clientes/${client.id}/predios`}>
                 <PillButton variant="outline" className="w-full justify-center">Ver Predios <ChevronRight className="w-4 h-4 ml-1" /></PillButton>
              </Link>
            </div>
          </BentoCard>
        ))}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl text-[#2C2621]">Nuevo Cliente</h2>
               <button onClick={() => setShowCreateForm(false)} type="button"><XCircle className="w-6 h-6 text-[#6E6359]" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Nombre de la Empresa</label>
                <input required type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Nombre de Contacto</label>
                <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Contraseña (Temporal)</label>
                <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Teléfono</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Dirección (Opcional)</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => setShowCreateForm(false)} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar</PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
