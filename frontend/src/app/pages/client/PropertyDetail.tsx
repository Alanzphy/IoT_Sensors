import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
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
    <BentoCard variant="glass">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-[16px] bg-[rgba(143,175,122,0.15)] flex items-center justify-center border border-[rgba(143,175,122,0.3)]">
          <CropIcon className="w-6 h-6 text-[var(--accent-green)]" />
        </div>
        <div className="flex-1">
          <h3 className="section-title mb-0.5">{area.name}</h3>
          <p className="text-xs text-[var(--text-muted)]">{area.size || area.hectares || 0} ha</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Humedad</span>
            <span className="font-data text-sm font-bold text-[var(--accent-green)]">
              {humidity !== null ? humidity.toFixed(1) + '%' : 'N/A'}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${displayHumidity}%`,
                background: "linear-gradient(90deg, var(--accent-green), var(--accent-green-hover))",
                boxShadow: "0 0 10px rgba(143,175,122,0.4)"
              }}
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
    return <div className="page-wrapper p-8 text-[var(--text-muted)]">No property selected</div>;
  }

  const propertyAreas = areas.filter(a => a.property_id === selectedProperty.id);

  return (
    <div className="page-wrapper overflow-x-hidden">
      <div className="mb-6 animate-fade-in">
        <h1 className="page-title text-gradient mb-2">{selectedProperty.name || "Propiedad"}</h1>
        <div className="flex items-center gap-2 text-[var(--text-muted)] bg-[rgba(255,255,255,0.05)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full inline-flex">
          <MapPin className="w-4 h-4 text-[var(--accent-green)]" />
          <span className="text-sm">{selectedProperty.location || "Chihuahua, Chihuahua"}</span>
        </div>
      </div>

      {/* Map placeholder */}
      <BentoCard variant="glass" className="mb-8 p-1 animate-fade-in-up flex flex-col">
        <div className="p-5 border-b border-[var(--border-subtle)]">
          <h3 className="section-title mb-0">Ubicación de Sensores</h3>
        </div>
        <div className="h-[300px] w-full bg-[#111] relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mt-1 rounded-b-[var(--radius-xl)]">
          {/* Simple map illustration lines */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
              <path d="M0,150 Q100,100 200,150 T400,150" stroke="var(--accent-green)" strokeWidth="4" fill="none" />
              <path d="M50,50 L100,100 L150,80 L200,120 M200,100 L300,50" stroke="var(--accent-gold)" strokeWidth="2" fill="none" strokeDasharray="5,5" />
            </svg>
          </div>

          {/* Map markers */}
          {[
            { top: "30%", left: "20%", num: 1 },
            { top: "50%", left: "45%", num: 2 },
            { top: "40%", left: "70%", num: 3 },
            { top: "65%", left: "60%", num: 4 },
          ].map(marker => (
            <div key={marker.num} className="absolute group" style={{ top: marker.top, left: marker.left }}>
              <div className="relative">
                <div className="w-8 h-8 bg-[var(--accent-green)] rounded-full flex items-center justify-center text-[#111] text-xs font-bold relative z-10 shadow-[0_0_15px_var(--accent-green)]">
                  {marker.num}
                </div>
                {/* Ping animation effect */}
                <div className="absolute inset-0 bg-[var(--accent-green)] rounded-full animate-ping opacity-75"></div>
              </div>
            </div>
          ))}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)]"></div>
            <p className="text-white text-xs font-medium">{propertyAreas.length} sensores activos</p>
          </div>
        </div>
      </BentoCard>

      {/* Areas grid */}
      <div className="mb-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <h2 className="text-xl text-[var(--text-primary)] font-semibold mb-4">Áreas de Riego</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
        {propertyAreas.map((area) => (
          <AreaCard key={area.id} area={area} />
        ))}
      </div>
    </div>
  );
}
