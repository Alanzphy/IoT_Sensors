import { ChevronRight } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { cropIcons } from "../../components/icons/CropIcons";
import { irrigationAreas } from "../../data/mockData";
import { Link } from "react-router";

export function AreaSelector() {
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Predios y Áreas de Riego</h1>
        <p className="text-[#6E6359]">Selecciona un área para ver sus datos en tiempo real</p>
      </div>

      {/* Property Group */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl text-[#2C2621]">Rancho Norte</h2>
          <span className="text-sm text-[#6E6359]">Chihuahua, Chih.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {irrigationAreas.map((area) => {
            const CropIcon = cropIcons[area.cropType];
            const lastReading = new Date(Date.now() - Math.random() * 30 * 60 * 1000);

            return (
              <Link key={area.id} to={`/cliente`}>
                <BentoCard variant="light" className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-[24px] bg-[#E2D4B7]">
                        <CropIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg text-[#2C2621] font-medium">{area.name}</h3>
                        <p className="text-sm text-[#6E6359]">{area.size} hectáreas</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#6E6359]" />
                  </div>

                  {/* Current humidity */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#6E6359]">Humedad actual</span>
                      <span className="font-bold text-[#2C2621]">
                        {(42 + Math.random() * 10).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#E6E1D8] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#6D7E5E] rounded-full transition-all"
                        style={{ width: `${42 + Math.random() * 10}%` }}
                      />
                    </div>
                  </div>

                  <FreshnessIndicator lastUpdate={lastReading} />
                </BentoCard>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Another Property */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl text-[#2C2621]">Predio Sur</h2>
          <span className="text-sm text-[#6E6359]">Delicias, Chih.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <BentoCard variant="light" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-[24px] bg-[#E2D4B7]">
                  {cropIcons.chile && <cropIcons.chile className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg text-[#2C2621] font-medium">Chile Norte</h3>
                  <p className="text-sm text-[#6E6359]">6.2 hectáreas</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6E6359]" />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6E6359]">Humedad actual</span>
                <span className="font-bold text-[#2C2621]">48.3%</span>
              </div>
              <div className="h-2 bg-[#E6E1D8] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#6D7E5E] rounded-full transition-all"
                  style={{ width: "48.3%" }}
                />
              </div>
            </div>

            <FreshnessIndicator lastUpdate={new Date(Date.now() - 18 * 60 * 1000)} />
          </BentoCard>

          <BentoCard variant="light" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-[24px] bg-[#E2D4B7]">
                  {cropIcons.algodon && <cropIcons.algodon className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg text-[#2C2621] font-medium">Algodón Este</h3>
                  <p className="text-sm text-[#6E6359]">18.5 hectáreas</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6E6359]" />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6E6359]">Humedad actual</span>
                <span className="font-bold text-[#2C2621]">52.1%</span>
              </div>
              <div className="h-2 bg-[#E6E1D8] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#6D7E5E] rounded-full transition-all"
                  style={{ width: "52.1%" }}
                />
              </div>
            </div>

            <FreshnessIndicator lastUpdate={new Date(Date.now() - 8 * 60 * 1000)} />
          </BentoCard>
        </div>
      </div>
    </div>
  );
}
