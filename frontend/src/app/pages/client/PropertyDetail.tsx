import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { PageTransition } from "../../components/PageTransition";
import { cropIcons } from "../../components/icons/CropIcons";
import { useSelection } from "../../context/SelectionContext";
import { api } from "../../services/api";

function AreaCard({ area }: { area: any }) {
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastReading, setLastReading] = useState<Date | null>(null);

  useEffect(() => {
    api.get(`/readings/?irrigation_area_id=${area.id}&per_page=1`)
      .then(res => {
        const data = res.data;
        if (data.items && data.items.length > 0) {
          const reading = data.items[0];
          setHumidity(reading.soil?.humidity ?? null);
          setLastReading(new Date(reading.timestamp));
        }
      })
      .catch(err => {
        console.error("Failed to fetch latest reading", err);
      });
  }, [area.id]);

  const rawCropName = area.crop_type?.name?.toLowerCase() || '';
  const IconKey = Object.keys(cropIcons).find(k => k.toLowerCase() === rawCropName);
  const CropIcon = IconKey ? cropIcons[IconKey as keyof typeof cropIcons] : cropIcons["nogal"];

  const displayHumidity = humidity ?? 0;

  return (
    <BentoCard variant="light" className="h-full">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-3 rounded-[24px] bg-[var(--card-sand)]">
          <CropIcon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg text-[var(--text-title)] font-medium">{area.name}</h3>
          <p className="text-sm text-[var(--text-subtle)]">{area.size || area.hectares || 0} ha</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[var(--text-subtle)]">Humedad</span>
            <span className="font-bold text-[var(--text-body)]">
              {humidity !== null ? humidity.toFixed(1) + '%' : 'N/A'}
            </span>
          </div>
          <div className="h-2 bg-[var(--progress-track)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] rounded-full transition-all"
              style={{ width: `${displayHumidity}%` }}
            />
          </div>
        </div>

        {lastReading && <FreshnessIndicator lastUpdate={lastReading} />}
      </div>
    </BentoCard>
  );
}

export function PropertyDetail() {
  const { selectedProperty, areas } = useSelection();

  if (!selectedProperty) {
    return (
      <div className="min-h-screen p-8 text-[var(--text-subtle)]">No property selected</div>
    );
  }

  const propertyAreas = areas.filter(a => a.property_id === selectedProperty.id);

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl text-[var(--text-title)] mb-2">{selectedProperty.name || "Propiedad"}</h1>
          <div className="flex items-center gap-2 text-[var(--text-subtle)]">
            <MapPin className="w-4 h-4" />
            <span>{selectedProperty.location || "Chihuahua, Chihuahua"}</span>
          </div>
        </div>

        {/* Map placeholder */}
        <BentoCard variant="light" className="mb-6">
          <h3 className="text-lg text-[var(--text-title)] mb-4">Ubicación de Sensores</h3>
          <div className="h-[300px] bg-[var(--surface-card-secondary)] rounded-[24px] flex items-center justify-center relative overflow-hidden">
          {/* Simple map illustration */}
            <div className="absolute inset-0 opacity-20">
              <svg className="w-full h-full" viewBox="0 0 400 300">
                <path d="M0,150 Q100,100 200,150 T400,150" stroke="var(--accent-primary)" strokeWidth="2" fill="none" />
                <path d="M50,50 L100,100 L150,80 L200,120" stroke="var(--card-brown)" strokeWidth="1.5" fill="none" />
              </svg>
            </div>

          {/* Map markers */}
            <div className="absolute top-[30%] left-[20%]">
              <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center text-[var(--text-inverted)] text-xs font-bold animate-pulse">
                1
              </div>
            </div>
            <div className="absolute top-[50%] left-[45%]">
              <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center text-[var(--text-inverted)] text-xs font-bold animate-pulse">
                2
              </div>
            </div>
            <div className="absolute top-[40%] left-[70%]">
              <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center text-[var(--text-inverted)] text-xs font-bold animate-pulse">
                3
              </div>
            </div>
            <div className="absolute top-[65%] left-[60%]">
              <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center text-[var(--text-inverted)] text-xs font-bold animate-pulse">
                4
              </div>
            </div>


            <div className="text-center z-10">
              <MapPin className="w-12 h-12 text-[var(--accent-primary)] mx-auto mb-2" />
              <p className="text-[var(--text-subtle)]">Mapa con {propertyAreas.length} sensores activos</p>
            </div>
          </div>
        </BentoCard>

        {/* Areas grid */}
        <div className="mb-4">
          <h2 className="text-xl text-[var(--text-title)] mb-4">Áreas de Riego</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {propertyAreas.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
