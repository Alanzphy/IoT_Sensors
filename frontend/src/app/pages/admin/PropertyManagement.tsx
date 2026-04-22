import { ChevronRight, Plus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";

type Property = {
  id: number;
  client_id: number;
  name: string;
  location: string | null;
};

export function PropertyManagement() {
  const { clientId } = useParams<{ clientId: string }>();
  const { showToast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [clientName, setClientName] = useState("Cargando...");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });

  const fetchData = async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const [resClient, resProps] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/properties?client_id=${clientId}`)
      ]);
      setClientName(resClient.data.company_name);
      setProperties(resProps.data.data || []);
    } catch (err) {
      console.error(err);
      setClientName("Desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/properties", {
        ...formData,
        client_id: Number(clientId)
      });
      setShowCreateForm(false);
      setFormData({ name: "", location: "" });
      fetchData();
      showToast("Predio creado", "success");
    } catch (err: any) {
      showToast("Error al crear el predio: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
          <Link to="/admin/clientes" className="hover:text-[var(--accent-primary)]">Clientes</Link>
          <span>/</span>
          <span>{clientName}</span>
          <span>/</span>
          <span>Predios</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl text-[var(--text-main)]">Predios</h1>
          <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Predio
          </PillButton>
        </div>
      </div>

      <div className="hidden md:block">
        <BentoCard variant="light">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">Ubicación</th>
                <th scope="col" className="text-right py-3 px-4 text-sm font-medium text-[var(--text-muted)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="py-4 text-center">Cargando...</td></tr>
              ) : properties.map((prop) => (
                <tr key={prop.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--text-main)]/5 transition-colors">
                  <td className="py-3 px-4 text-[var(--text-main)]">{prop.name}</td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">{prop.location || "-"}</td>
                  <td className="py-3 px-4 flex justify-end gap-2">
                    <Link to={`/admin/predios/${prop.id}/areas`}>
                      <PillButton variant="outline" className="px-3 py-1 text-xs">Áreas de Riego <ChevronRight className="w-3 h-3 ml-1" /></PillButton>
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && properties.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-[var(--text-muted)]">No hay predios registrados.</td></tr>
              )}
            </tbody>
          </table>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading && <div className="text-center py-4">Cargando...</div>}
        {!loading && properties.map((prop) => (
          <BentoCard key={prop.id} variant="light" className="p-4">
            <h3 className="text-[var(--text-main)] font-medium mb-1">{prop.name}</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">{prop.location || "Sin ubicación"}</p>
            <Link to={`/admin/predios/${prop.id}/areas`}>
               <PillButton variant="outline" className="w-full justify-center">Ver Áreas de Riego <ChevronRight className="w-4 h-4 ml-1" /></PillButton>
            </Link>
          </BentoCard>
        ))}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--text-main)]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl text-[var(--text-main)]">Nuevo Predio</h2>
              <button onClick={() => setShowCreateForm(false)}><XCircle className="w-6 h-6 text-[var(--text-muted)]" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Nombre del Predio</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Ubicación (Opcional)</label>
                <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
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
