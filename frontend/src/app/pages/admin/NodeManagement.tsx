import { Copy, Eye, EyeOff, Plus, Radio, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
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

export function NodeManagement() {
  const { showToast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<number, boolean>>({});

  // Form State
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
      if (typeof errorDetail === "string") {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMessage = errorDetail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      } else if (errorDetail) {
        errorMessage = JSON.stringify(errorDetail);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        is_active: true
      });
      setShowCreateForm(false);
      setFormName("");
      setFormSerialNumber("");
      setFormLat("");
      setFormLng("");
      setFormAreaId("");
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
    setVisibleApiKeys(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("API Key copiada al portapapeles", "success");
  };

  const getAreaName = (id: number) => {
    const area = areas.find(a => a.id === id);
    return area ? area.nombre : "Desconocida";
  };

  if (loading && nodes.length === 0) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <div className="h-8 w-48 rounded-full animate-pulse bg-black/10 mb-2" />
          <div className="h-5 w-64 rounded-full animate-pulse bg-black/10 opacity-60" />
        </div>
        <BentoCard variant="light" className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2C2621]/10">
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} scope="col" className="py-3 px-4">
                    <div className="h-4 rounded-full animate-pulse bg-black/10 opacity-50" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="py-4 px-4">
                      <div className="h-4 rounded-full animate-pulse bg-black/10" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </BentoCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Gestión de Nodos</h1>
          <p className="text-[#6E6359]">Administra los sensores IoT del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Nodo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <BentoCard variant="light" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2C2621]/10">
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Serie</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">API Key</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Área Vinculada</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">GPS</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Estado</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, i) => (
                <tr key={node.id} className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}>
                  <td className="py-4 px-4">
                    <span className="font-medium text-[#2C2621]">
                      {node.name || `Nodo #${node.id}`}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-[#6E6359] font-mono">
                    {node.serial_number || '-'}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#6E6359] font-mono">
                        {visibleApiKeys[node.id]
                          ? node.api_key
                          : '••••••••••••••••'
                        }
                      </span>
                      <button
                        onClick={() => toggleApiKeyVisibility(node.id)}
                        className="p-1 rounded hover:bg-[#E2D4B7]/50 transition-colors"
                      >
                        {visibleApiKeys[node.id] ? (
                          <EyeOff className="w-4 h-4 text-[#6E6359]" />
                        ) : (
                          <Eye className="w-4 h-4 text-[#6E6359]" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(node.api_key)}
                        className="p-1 rounded hover:bg-[#E2D4B7]/50 transition-colors"
                      >
                        <Copy className="w-4 h-4 text-[#6E6359]" />
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-[#2C2621]">
                    {getAreaName(node.irrigation_area_id)}
                  </td>
                  <td className="py-4 px-4 text-sm text-[#6E6359]">
                    {node.latitude && node.longitude
                      ? `${node.latitude}, ${node.longitude}`
                      : 'No configurado'
                    }
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      node.is_active
                        ? 'bg-[#6D7E5E]/10 text-[#6D7E5E] border border-[#6D7E5E]/20'
                        : 'bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20'
                    }`}>
                      {node.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleDelete(node.id)}
                      className="p-2 rounded-full hover:bg-[#DC2626]/10 transition-colors"
                      title="Eliminar nodo"
                    >
                      <Trash2 className="w-4 h-4 text-[#DC2626]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nodes.length === 0 && !loading && (
            <div className="py-8 px-4">
              <EmptyState
                icon={Radio}
                title="Sin nodos IoT registrados"
                description="Registra tu primer sensor para comenzar a recopilar datos de riego."
                action={{
                  label: "Crear primer nodo",
                  onClick: () => setShowCreateForm(true),
                }}
              />
            </div>
          )}
        </div>
      </BentoCard>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Nodo IoT</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Área de Riego (Obligatorio)</label>
                <select
                  required
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                >
                  <option value="">Seleccione un área</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Nombre del Nodo</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Número de Serie</label>
                <input
                  type="text"
                  value={formSerialNumber}
                  onChange={(e) => setFormSerialNumber(e.target.value)}
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#6E6359] mb-2">Latitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6E6359] mb-2">Longitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Guardando...' : 'Crear Nodo'}
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
