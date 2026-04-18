import { useState, useEffect } from "react";
import { Plus, Eye, EyeOff, Copy, MapPin, Radio, Trash2, X } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { Link } from "react-router";
import { api } from "../../services/api";

interface IrrigationArea {
  id: number;
  nombre: string;
}

interface NodeData {
  id: number;
  irrigation_area_id: number;
  api_key: string;
  serial_number: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function GlassInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--border-glass)",
        color: "var(--text-primary)",
        outline: "none",
        ...props.style,
      }}
      onFocus={e => {
        e.target.style.borderColor = "var(--border-accent)";
        e.target.style.background = "rgba(255,255,255,0.07)";
        e.target.style.boxShadow = "0 0 0 3px rgba(143,175,122,0.1)";
      }}
      onBlur={e => {
        e.target.style.borderColor = "var(--border-glass)";
        e.target.style.background = "rgba(255,255,255,0.05)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}

function GlassSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200 appearance-none"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--border-glass)",
        color: "var(--text-primary)",
        outline: "none",
        ...props.style,
      }}
    >
      {children}
    </select>
  );
}

export function NodeManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formSerialNumber, setFormSerialNumber] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formAreaId, setFormAreaId] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const nodesRes = await api.get("/nodes?per_page=100");
      const areasRes = await api.get("/irrigation-areas?per_page=100");
      setNodes(nodesRes.data.data || nodesRes.data);
      setAreas(areasRes.data.data || areasRes.data);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      let errorMessage = "Error loading nodes";
      if (typeof errorDetail === "string") errorMessage = errorDetail;
      else if (Array.isArray(errorDetail)) errorMessage = errorDetail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      else if (errorDetail) errorMessage = JSON.stringify(errorDetail);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAreaId) return;
    try {
      setLoading(true);
      await api.post("/nodes", {
        irrigation_area_id: parseInt(formAreaId),
        name: formName || null,
        serial_number: formSerialNumber || null,
        latitude: formLat ? parseFloat(formLat) : null,
        longitude: formLng ? parseFloat(formLng) : null,
        is_active: true,
      });
      setShowCreateForm(false);
      setFormName(""); setFormSerialNumber(""); setFormLat(""); setFormLng(""); setFormAreaId("");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating node");
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este nodo?")) return;
    try {
      setLoading(true);
      await api.delete(`/nodes/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error deleting node");
      setLoading(false);
    }
  };

  const toggleApiKeyVisibility = (nodeId: number) => {
    setVisibleApiKeys(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const copyToClipboard = (nodeId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(nodeId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getAreaName = (id: number) => {
    const area = areas.find(a => a.id === id);
    return area ? area.nombre : "No asignada";
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="page-title text-gradient">Gestión de Nodos</h1>
          <p className="page-subtitle">Administra los sensores IoT del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4" />
          Nuevo Nodo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm badge-danger w-full">{error}</div>
      )}

      {/* Table */}
      <div className="animate-fade-in-up">
        <BentoCard variant="glass" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-dark">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Nombre</th>
                  <th>Serie</th>
                  <th>API Key</th>
                  <th>Área Vinculada</th>
                  <th>GPS</th>
                  <th className="text-right pr-5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && nodes.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((__, j) => (
                        <td key={j}><div className="h-4 rounded shimmer" style={{ width: "70%" }} /></td>
                      ))}
                    </tr>
                  ))
                ) : nodes.map((node) => (
                  <tr key={node.id}>
                    <td>
                      <span className={`status-dot ${node.is_active ? "active" : "inactive"}`} />
                    </td>
                    <td>
                      <Link to={`/admin/nodos/${node.id}`} className="font-medium hover:underline" style={{ color: "var(--text-primary)" }}>
                        {node.name || `Nodo #${node.id}`}
                      </Link>
                    </td>
                    <td>
                      <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
                        {node.serial_number || "—"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-data text-xs" style={{ color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
                          {visibleApiKeys[node.id] ? node.api_key : "••••••••••••••••"}
                        </span>
                        <button
                          onClick={() => toggleApiKeyVisibility(node.id)}
                          className="p-1 rounded-lg transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {visibleApiKeys[node.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(node.id, node.api_key)}
                          className="p-1 rounded-lg transition-all"
                          style={{ color: copiedId === node.id ? "var(--status-active)" : "var(--text-muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          title={copiedId === node.id ? "¡Copiado!" : "Copiar API Key"}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{getAreaName(node.irrigation_area_id)}</td>
                    <td>
                      {node.latitude && node.longitude ? (
                        <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
                          {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="badge-inactive">Sin GPS</span>
                      )}
                    </td>
                    <td className="text-right pr-5">
                      <button
                        onClick={() => handleDelete(node.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        title="Eliminar nodo"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = "var(--status-danger-bg)";
                          (e.currentTarget as HTMLElement).style.color = "var(--status-danger)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {nodes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                      No hay nodos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>

      {/* Create modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-md animate-fade-in-up">
            <BentoCard variant="glass">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">Nuevo Nodo IoT</h2>
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
                <FormField label="Área de Riego (Obligatorio)">
                  <GlassSelect required value={formAreaId} onChange={e => setFormAreaId(e.target.value)}>
                    <option value="" style={{ background: "var(--bg-elevated)" }}>Seleccione un área</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id} style={{ background: "var(--bg-elevated)" }}>{a.nombre}</option>
                    ))}
                  </GlassSelect>
                </FormField>
                <FormField label="Nombre del Nodo">
                  <GlassInput type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Sensor Nogal-01" />
                </FormField>
                <FormField label="Número de Serie">
                  <GlassInput type="text" value={formSerialNumber} onChange={e => setFormSerialNumber(e.target.value)} placeholder="SN-2026-001" />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Latitud GPS">
                    <GlassInput type="number" step="any" value={formLat} onChange={e => setFormLat(e.target.value)} placeholder="28.6329" />
                  </FormField>
                  <FormField label="Longitud GPS">
                    <GlassInput type="number" step="any" value={formLng} onChange={e => setFormLng(e.target.value)} placeholder="-106.0691" />
                  </FormField>
                </div>
                <div className="flex gap-3 pt-2">
                  <PillButton variant="ghost" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>Cancelar</PillButton>
                  <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Guardando..." : "Crear Nodo"}
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
