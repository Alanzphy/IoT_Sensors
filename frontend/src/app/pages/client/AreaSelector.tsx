import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { cropIcons } from "../../components/icons/CropIcons";
import { IrrigationArea, useSelection } from "../../context/SelectionContext";
import { api } from "../../services/api";

function AreaCard({
  area,
  onClick,
}: {
  area: IrrigationArea;
  onClick: () => void;
}) {
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchLatestReading() {
      try {
        const res = await api.get(`/readings/latest?irrigation_area_id=${area.id}`);
        if (mounted && res.data) {
          if (res.data.soil?.humidity !== undefined && res.data.soil.humidity !== null) {
            setHumidity(res.data.soil.humidity);
          }
          if (res.data.timestamp) {
            setLastUpdate(new Date(res.data.timestamp));
          }
        }
      } catch (err) {
        console.error("Error fetching latest reading for area", area.id, err);
      }
    }
    fetchLatestReading();
    return () => {
      mounted = false;
    };
  }, [area.id]);

  // Normalize crop type name for icon lookup
  const cropName = area.crop_type?.name?.toLowerCase() || "";
  let CropIcon: any = cropIcons.nogal; // Default fallback
  if (cropName.includes("alfalfa")) CropIcon = cropIcons.alfalfa;
  else if (cropName.includes("manzana")) CropIcon = cropIcons.manzana;
  else if (cropName.includes("maíz") || cropName.includes("maiz")) CropIcon = cropIcons.maiz;
  else if (cropName.includes("chile")) CropIcon = cropIcons.chile;
  else if (cropName.includes("algodón") || cropName.includes("algodon")) CropIcon = cropIcons.algodon;

  return (
    <div onClick={onClick}>
      <BentoCard variant="glass" className="h-full flex flex-col justify-between cursor-pointer group">
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-[16px] flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ background: "rgba(143,175,122,0.15)", border: "1px solid rgba(143,175,122,0.3)" }}
              >
                <CropIcon className="w-6 h-6" style={{ color: "var(--accent-green)" }} />
              </div>
              <div>
                <h3 className="section-title mb-0.5">{area.name}</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{area.area_size || 0} hectáreas</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.05)" }}>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </div>
          </div>

          {/* Current humidity */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Humedad actual</span>
              <span className="font-data text-sm font-bold" style={{ color: "var(--accent-green)" }}>
                {humidity !== null ? `${humidity.toFixed(1)}%` : "N/D"}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  background: "linear-gradient(90deg, var(--accent-green), var(--accent-green-hover))",
                  width: humidity !== null ? `${Math.min(100, Math.max(0, humidity))}%` : "0%",
                  boxShadow: "0 0 10px rgba(143,175,122,0.4)"
                }}
              />
            </div>
          </div>
        </div>

        {lastUpdate && <FreshnessIndicator lastUpdate={lastUpdate} />}
      </BentoCard>
    </div>
  );
}

export function AreaSelector() {
  const { properties, areas, setSelectedProperty, setSelectedArea, loading, error } = useSelection();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="page-wrapper flex items-center justify-center">
        <p className="animate-pulse" style={{ color: "var(--text-muted)" }}>Cargando áreas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper flex items-center justify-center">
        <p className="badge-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="mb-8 animate-fade-in">
        <h1 className="page-title text-gradient">Predios y Áreas de Riego</h1>
        <p className="page-subtitle">Selecciona un área para ver sus datos en tiempo real</p>
      </div>

      <div className="space-y-8 stagger">
        {properties.map((property) => {
          const propertyAreas = areas.filter((a) => a.property_id === property.id);

          if (propertyAreas.length === 0) return null;

          return (
            <div key={property.id} className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-4 border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{property.name}</h2>
                {property.location && (
                  <span className="text-sm px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>{property.location}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {propertyAreas.map((area) => (
                  <AreaCard
                    key={area.id}
                    area={area}
                    onClick={() => {
                      setSelectedProperty(property);
                      setSelectedArea(area);
                      navigate("/cliente");
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {properties.length === 0 && (
          <div className="text-center py-12">
            <BentoCard variant="glass" className="inline-block max-w-sm">
              <p style={{ color: "var(--text-muted)" }}>No se encontraron predios disponibles.</p>
            </BentoCard>
          </div>
        )}
      </div>
    </div>
  );
}
