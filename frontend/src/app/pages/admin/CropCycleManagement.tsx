import { useState, useEffect } from "react";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

interface IrrigationArea {
  id: number;
  nombre: string;
}

interface CropCycle {
  id: number;
  irrigation_area_id: int;
  start_date: string;
  end_date: string | null;
}

export function CropCycleManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formAreaId, setFormAreaId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch both areas and cycles
      const [areasRes, cyclesRes] = await Promise.all([
        api.get("/irrigation-areas/all"),
        api.get("/crop-cycles")
      ]);
      setAreas(areasRes.data.data || areasRes.data);
      setCycles(cyclesRes.data.data || cyclesRes.data);
    } catch (err: any) {
      // In case /irrigation-areas/all doesn't exist, we fallback to /irrigation-areas
      if (err.response?.status === 404 && err.config.url.includes('/all')) {
          try {
              const [areasRes, cyclesRes] = await Promise.all([
                  api.get("/irrigation-areas"),
                  api.get("/crop-cycles")
              ]);
              setAreas(areasRes.data.data || areasRes.data);
              setCycles(cyclesRes.data.data || cyclesRes.data);
          } catch(err2: any) {
             setError(err2.response?.data?.detail || "Error loading data");
          }
      } else {
        setError(err.response?.data?.detail || "Error loading data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAreaId || !formStartDate) return;

    try {
      setLoading(true);
      await api.post("/crop-cycles", {
        irrigation_area_id: parseInt(formAreaId),
        start_date: formStartDate,
        end_date: formEndDate ? formEndDate : null,
      });
      setShowCreateForm(false);
      setFormAreaId("");
      setFormStartDate("");
      setFormEndDate("");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating crop cycle");
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este ciclo?")) return;
    try {
      setLoading(true);
      await api.delete(`/crop-cycles/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error deleting crop cycle");
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading && areas.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#6E6359]">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Gestión de Ciclos de Cultivo</h1>
          <p className="text-[#6E6359]">Administra los ciclos de cultivo por área</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ciclo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Timeline view */}
      <div className="space-y-6">
        {areas.map((area) => {
          const areaCycles = cycles.filter(c => c.irrigation_area_id === area.id)
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

          if (areaCycles.length === 0) return null;

          return (
            <BentoCard key={area.id} variant="light">
              <h3 className="text-lg font-medium text-[#2C2621] mb-4">{area.nombre}</h3>
              
              <div className="space-y-3">
                {areaCycles.map((cycle) => {
                  const isActive = !cycle.end_date || new Date(cycle.end_date) > new Date();

                  return (
                    <div 
                      key={cycle.id} 
                      className={`p-4 rounded-[24px] flex items-center justify-between ${
                        isActive 
                          ? "bg-[#6D7E5E]/10 border-2 border-[#6D7E5E]" 
                          : "bg-[#F4F1EB]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${isActive ? 'bg-[#6D7E5E] text-white' : 'bg-[#E2D4B7] text-[#6E6359]'}`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#2C2621]">
                              {formatDate(cycle.start_date)} - {cycle.end_date ? formatDate(cycle.end_date) : 'Actual'}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-[#6D7E5E] text-white">
                                Activo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(cycle.id)}
                        className="p-2 rounded-full hover:bg-[#DC2626]/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-[#DC2626]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </BentoCard>
          );
        })}
        {areas.length === 0 && !loading && (
          <p className="text-[#6E6359]">No hay áreas de riego registradas.</p>
        )}
        {areas.length > 0 && areas.every(a => cycles.filter(c => c.irrigation_area_id === a.id).length === 0) && !loading && (
          <p className="text-[#6E6359]">No hay ciclos de cultivo registrados en ninguna área.</p>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[#2C2621]/50 z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl text-[#2C2621] mb-6">Nuevo Ciclo de Cultivo</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Área de Riego</label>
                <select 
                  required
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                >
                  <option value="">Seleccionar área</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Fecha de Inicio</label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6E6359] mb-2">Fecha de Fin (opcional)</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Ciclo'}
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
