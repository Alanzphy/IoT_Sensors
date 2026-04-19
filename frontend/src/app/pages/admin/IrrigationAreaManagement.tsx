import { MoreVertical, Plus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";

type IrrigationArea = {
  id: number;
  property_id: number;
  crop_type_id: number;
  name: string;
  area_size: number | null;
  crop_type?: {
    id: number;
    name: string;
  };
};

type CropType = {
  id: number;
  name: string;
};

export function IrrigationAreaManagement() {
  const { predioId } = useParams<{ predioId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [propertyName, setPropertyName] = useState("Cargando...");
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("...");

  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    crop_type_id: "",
    area_size: "",
  });

  const fetchData = async () => {
    if (!predioId) return;
    try {
      setLoading(true);
      // Fetch property to get client info and name
      const propRes = await api.get(`/properties/${predioId}`);
      setPropertyName(propRes.data.name);
      setClientId(propRes.data.client_id);

      if (propRes.data.client_id) {
         const clientRes = await api.get(`/clients/${propRes.data.client_id}`);
         setClientName(clientRes.data.company_name);
      }

      // Fetch areas and crop types
      const [areasRes, cropsRes] = await Promise.all([
        api.get(`/irrigation-areas?property_id=${predioId}&per_page=100`),
        api.get("/crop-types?per_page=100")
      ]);
      setAreas(areasRes.data.data || []);
      setCropTypes(cropsRes.data.data || []);
    } catch (err) {
      console.error(err);
      setPropertyName("Desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [predioId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.crop_type_id) {
      showToast("Por favor selecciona un tipo de cultivo", "error");
      return;
    }
    try {
      await api.post("/irrigation-areas", {
        property_id: Number(predioId),
        crop_type_id: Number(formData.crop_type_id),
        name: formData.name,
        area_size: formData.area_size ? Number(formData.area_size) : null,
      });
      setShowCreateForm(false);
      setFormData({ name: "", crop_type_id: "", area_size: "" });
      fetchData();
      showToast("Área creada", "success");
    } catch (err: any) {
      showToast("Error al crear área: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[#6E6359] mb-2 flex-wrap">
          <Link to="/admin/clientes" className="hover:text-[#6D7E5E]">Clientes</Link>
          <span>/</span>
          {clientId ? (
            <Link to={`/admin/clientes/${clientId}/predios`} className="hover:text-[#6D7E5E]">
              {clientName}
            </Link>
          ) : (
             <span>{clientName}</span>
          )}
          <span>/</span>
          <span className="text-[#2C2621]">{propertyName}</span>
          <span>/</span>
          <span>Áreas de Riego</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl text-[#2C2621]">Áreas de Riego</h1>
          <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Área
          </PillButton>
        </div>
      </div>

      <div className="hidden md:block">
        <BentoCard variant="light">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2C2621]/10">
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Cultivo</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Tamaño (Ha)</th>
                <th scope="col" className="text-right py-3 px-4 text-sm font-medium text-[#6E6359]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-4 text-center">Cargando...</td></tr>
              ) : areas.map((area) => (
                <tr key={area.id} className="border-b border-[#2C2621]/5 last:border-0 hover:bg-[#2C2621]/5 transition-colors">
                  <td className="py-3 px-4 text-[#2C2621]">{area.name}</td>
                  <td className="py-3 px-4 text-[#6E6359]">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#E5E0D8] text-[#2C2621] text-xs">
                       {area.crop_type?.name || "No asignado"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#6E6359]">{area.area_size ? `${area.area_size} Ha` : "-"}</td>
                  <td className="py-3 px-4 flex justify-end gap-2">
                    <button className="p-2 text-[#6E6359] hover:bg-[#E5E0D8] rounded-full transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && areas.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-[#6E6359]">No hay áreas registradas.</td></tr>
              )}
            </tbody>
          </table>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading && <div className="text-center py-4">Cargando...</div>}
        {!loading && areas.map((area) => (
          <BentoCard key={area.id} variant="light" className="p-4">
             <div className="flex justify-between items-start mb-2">
              <h3 className="text-[#2C2621] font-medium">{area.name}</h3>
              <button className="text-[#6E6359]"><MoreVertical className="w-5 h-5"/></button>
            </div>
            <div className="flex items-center gap-2 mt-2">
               <span className="px-2 py-1 bg-[#E5E0D8] text-[#2C2621] text-xs rounded-full">{area.crop_type?.name || "Sin Cultivo"}</span>
               {area.area_size && <span className="text-sm text-[#6E6359]">{area.area_size} Ha</span>}
            </div>
          </BentoCard>
        ))}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl text-[#2C2621]">Nueva Área de Riego</h2>
              <button onClick={() => setShowCreateForm(false)} type="button"><XCircle className="w-6 h-6 text-[#6E6359]" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Nombre del Área</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Tipo de Cultivo</label>
                <select required value={formData.crop_type_id} onChange={e => setFormData({ ...formData, crop_type_id: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none">
                  <option value="">Selecciona un cultivo</option>
                  {cropTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#6E6359] mb-1">Tamaño (Hectáreas) - Opcional</label>
                <input type="number" step="0.01" value={formData.area_size} onChange={e => setFormData({ ...formData, area_size: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 focus:outline-none" />
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
