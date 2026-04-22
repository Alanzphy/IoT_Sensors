import { Edit, Leaf, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { cropIcons } from "../../components/icons/CropIcons";
import { api } from "../../services/api";

interface CropType {
  id: number;
  name: string;
  description: string;
}

export function CropTypeManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/crop-types");
      setCropTypes(res.data.data || res.data); // Support both formats
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error loading crop types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      await api.post("/crop-types", {
        name,
        description,
      });
      setShowCreateForm(false);
      setName("");
      setDescription("");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating crop type");
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este tipo de cultivo?")) return;
    try {
      setLoading(true);
      await api.delete(`/crop-types/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error deleting crop type");
      setLoading(false);
    }
  };

  if (loading && cropTypes.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[var(--text-muted)]">Cargando cultivos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[var(--text-main)] mb-2">Catálogo de Cultivos</h1>
          <p className="text-[var(--text-muted)]">Gestiona los tipos de cultivo disponibles</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cultivo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Desktop grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cropTypes.map((crop) => {
          const rawName = crop.name.toLowerCase();
          const CropIcon = cropIcons[rawName] || Leaf;

          return (
            <BentoCard key={crop.id} variant="light">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-[24px] bg-[var(--card-sand)]">
                    <CropIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-main)]">{crop.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Edit functionality left for future if needed */}
                  <button className="p-2 rounded-full hover:bg-[var(--card-sand)]/50 transition-colors">
                    <Edit className="w-4 h-4 text-[var(--text-muted)]/30" />
                  </button>
                  <button
                    onClick={() => handleDelete(crop.id)}
                    className="p-2 rounded-full hover:bg-[#DC2626]/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-[#DC2626]" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{crop.description}</p>
            </BentoCard>
          );
        })}
        {cropTypes.length === 0 && !loading && (
          <p className="text-[var(--text-muted)]">No hay tipos de cultivo registrados.</p>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--text-main)]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[var(--text-main)] mb-6">Nuevo Tipo de Cultivo</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Nombre del Cultivo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Nogal"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Descripción</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Nogal pecanero"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Cultivo'}
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
