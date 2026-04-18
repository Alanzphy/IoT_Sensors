import { Edit, Leaf, Plus, Trash2, X } from "lucide-react";
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

// Accent colors per crop for visual differentiation
const cropAccents: Record<string, { color: string; bg: string }> = {
  nogal:    { color: "#C4A46D", bg: "rgba(196,164,109,0.12)" },
  alfalfa:  { color: "#8FAF7A", bg: "rgba(143,175,122,0.12)" },
  manzana:  { color: "#E07B54", bg: "rgba(224,123,84,0.12)" },
  maíz:     { color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  maiz:     { color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  chile:    { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  algodón:  { color: "#E2D4B7", bg: "rgba(226,212,183,0.1)" },
  algodon:  { color: "#E2D4B7", bg: "rgba(226,212,183,0.1)" },
};

function GlassInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-primary)", outline: "none", ...props.style }}
      onFocus={e => { e.target.style.borderColor = "var(--border-accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(143,175,122,0.1)"; }}
      onBlur={e => { e.target.style.borderColor = "var(--border-glass)"; e.target.style.boxShadow = "none"; }}
    />
  );
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
      setCropTypes(res.data.data || res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error loading crop types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      await api.post("/crop-types", { name, description });
      setShowCreateForm(false);
      setName(""); setDescription("");
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

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="page-title text-gradient">Catálogo de Cultivos</h1>
          <p className="page-subtitle">Gestiona los tipos de cultivo disponibles</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4" />
          Nuevo Cultivo
        </PillButton>
      </div>

      {error && <div className="mb-4 p-3 rounded-xl text-sm badge-danger w-full">{error}</div>}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up stagger">
        {loading && cropTypes.length === 0
          ? [...Array(6)].map((_, i) => (
              <div key={i} className="glass-card rounded-2xl h-[100px] shimmer" />
            ))
          : cropTypes.map((crop) => {
              const rawName = crop.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const CropIcon = cropIcons[crop.name.toLowerCase()] || Leaf;
              const accent = cropAccents[crop.name.toLowerCase()] || cropAccents[rawName] || { color: "var(--accent-green)", bg: "rgba(143,175,122,0.1)" };

              return (
                <BentoCard key={crop.id} variant="glass" className="group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                        style={{ background: accent.bg, border: `1px solid ${accent.color}30` }}
                      >
                        <CropIcon className="w-5 h-5" style={{ color: accent.color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>
                          {crop.name}
                        </h3>
                        {crop.description && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                            {crop.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="Editar (próximamente)"
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(crop.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="Eliminar"
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = "var(--status-danger-bg)";
                          (e.currentTarget as HTMLElement).style.color = "var(--status-danger)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Accent bottom line */}
                  <div
                    className="h-px w-full rounded-full mt-2"
                    style={{ background: `linear-gradient(to right, ${accent.color}40, transparent)` }}
                  />
                </BentoCard>
              );
            })}
        {cropTypes.length === 0 && !loading && (
          <p className="col-span-3 text-center py-8" style={{ color: "var(--text-muted)" }}>
            No hay tipos de cultivo registrados.
          </p>
        )}
      </div>

      {/* Create modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-sm animate-fade-in-up">
            <BentoCard variant="glass">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">Nuevo Tipo de Cultivo</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Nombre del Cultivo
                  </label>
                  <GlassInput type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Nogal" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Descripción
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ej: Nogal pecanero de alta producción"
                    className="w-full px-4 py-2.5 rounded-xl text-sm resize-none transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                    onFocus={e => { e.target.style.borderColor = "var(--border-accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(143,175,122,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--border-glass)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <PillButton variant="ghost" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>Cancelar</PillButton>
                  <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Creando..." : "Crear Cultivo"}
                  </PillButton>
                </div>
              </form>
            </BentoCard>
          </div>
        </div>
      )}
    </div>
  );
}
