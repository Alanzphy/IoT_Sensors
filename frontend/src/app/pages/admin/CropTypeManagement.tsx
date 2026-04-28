import { Edit, Leaf, Plus, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
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
  const [showEditForm, setShowEditForm] = useState(false);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

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

  const openEdit = (crop: CropType) => {
    setEditingCropId(crop.id);
    setEditName(crop.name || "");
    setEditDescription(crop.description || "");
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCropId || !editName.trim()) return;

    try {
      setLoading(true);
      await api.put(`/crop-types/${editingCropId}`, {
        name: editName,
        description: editDescription,
      });
      setShowEditForm(false);
      setEditingCropId(null);
      setEditName("");
      setEditDescription("");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error updating crop type");
      setLoading(false);
    }
  };

  if (loading && cropTypes.length === 0) {
    return (
      <PageTransition>
        <div className="flex justify-center items-center min-h-screen p-4 text-[var(--text-subtle)]">
          Cargando cultivos...
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">Catálogo de Cultivos</h1>
          <p className="text-[var(--text-subtle)]">Gestiona los tipos de cultivo disponibles</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cultivo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cropTypes.map((crop) => {
          const rawName = crop.name.toLowerCase();
          const CropIcon = cropIcons[rawName] || Leaf;

          return (
            <BentoCard key={crop.id} variant="light">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-[24px] bg-[var(--surface-card-secondary)] border border-[var(--border-subtle)]">
                    <CropIcon className="w-6 h-6 text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-main)]">{crop.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(crop)}
                    className="p-2 rounded-full hover:bg-[var(--hover-overlay)] transition-colors"
                    title="Editar cultivo"
                  >
                    <Edit className="w-4 h-4 text-[var(--text-subtle)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(crop.id)}
                    className="p-2 rounded-full hover:bg-[var(--status-danger-bg)] transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-[var(--status-danger)]" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">{crop.description || "Sin descripción"}</p>
            </BentoCard>
          );
        })}
        {cropTypes.length === 0 && !loading && (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState
              icon={Leaf}
              title="Sin tipos de cultivo"
              description="Agrega cultivos al catálogo para asignarlos en áreas de riego."
              action={{
                label: "Crear primer cultivo",
                onClick: () => setShowCreateForm(true),
              }}
            />
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Nuevo Tipo de Cultivo</h2>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Nombre del Cultivo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Nogal"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Descripción</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Nogal pecanero"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
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

      {showEditForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Editar Tipo de Cultivo</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingCropId(null);
                }}
                className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Nombre del Cultivo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Descripción</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton
                  variant="secondary"
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingCropId(null);
                  }}
                >
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
