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
      <BentoCard variant="light" className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-[24px] bg-[#E2D4B7]">
                <CropIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg text-[#2C2621] font-medium">{area.name}</h3>
                <p className="text-sm text-[#6E6359]">{area.area_size || 0} hectáreas</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6E6359]" />
          </div>

          {/* Current humidity */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#6E6359]">Humedad actual</span>
              <span className="font-bold text-[#2C2621]">
                {humidity !== null ? `${humidity.toFixed(1)}%` : "N/D"}
              </span>
            </div>
            <div className="h-2 bg-[#E6E1D8] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6D7E5E] rounded-full transition-all"
                style={{ width: humidity !== null ? `${Math.min(100, Math.max(0, humidity))}%` : "0%" }}
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
      <div className="min-h-screen p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <p className="text-[#6E6359]">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Predios y Áreas de Riego</h1>
        <p className="text-[#6E6359]">Selecciona un área para ver sus datos en tiempo real</p>
      </div>

      {properties.map((property) => {
        const propertyAreas = areas.filter((a) => a.property_id === property.id);

        if (propertyAreas.length === 0) return null;

        return (
          <div key={property.id} className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-[#2C2621]">{property.name}</h2>
              {property.location && (
                <span className="text-sm text-[#6E6359]">{property.location}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="text-center py-10 text-[#6E6359]">
          No se encontraron predios disponibles.
        </div>
      )}
    </div>
  );
}
