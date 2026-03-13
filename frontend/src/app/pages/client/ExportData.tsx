import { Calendar, Download, Filter } from "lucide-react";
import { useState } from "react";
import { PillButton } from "../../components/PillButton";
import { BentoCard } from "../../components/BentoCard";

export function ExportData() {
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedSensor, setSelectedSensor] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("csv");

  const handleExport = () => {
    // Mock export functionality
    alert("Exportando datos en formato " + format.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">
            Exportar Datos
          </h1>
          <p className="text-[#6B5E4C]">
            Descarga el histórico de tus sensores en diferentes formatos
          </p>
        </div>

        {/* Export Configuration */}
        <BentoCard className="p-6">
          <div className="space-y-6">
            {/* Date Range */}
            <div>
              <label className="flex items-center gap-2 text-[#2C2621] mb-3">
                <Calendar className="w-5 h-5 text-[#7C8F5C]" />
                <span className="font-medium">Rango de Fechas</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6B5E4C] mb-2">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6B5E4C] mb-2">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C]"
                  />
                </div>
              </div>
            </div>

            {/* Area Selection */}
            <div>
              <label className="flex items-center gap-2 text-[#2C2621] mb-3">
                <Filter className="w-5 h-5 text-[#7C8F5C]" />
                <span className="font-medium">Filtros</span>
              </label>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#6B5E4C] mb-2">
                    Área de Riego
                  </label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C]"
                  >
                    <option value="all">Todas las áreas</option>
                    <option value="area-1">Parcela Norte - Aguacate</option>
                    <option value="area-2">Campo Sur - Maíz</option>
                    <option value="area-3">Invernadero A - Tomate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#6B5E4C] mb-2">
                    Tipo de Sensor
                  </label>
                  <select
                    value={selectedSensor}
                    onChange={(e) => setSelectedSensor(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C]"
                  >
                    <option value="all">Todos los sensores</option>
                    <option value="humidity">Humedad de Suelo</option>
                    <option value="temperature">Temperatura</option>
                    <option value="ph">pH del Suelo</option>
                    <option value="ec">Conductividad Eléctrica</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-[#2C2621] mb-3 font-medium">
                Formato de Exportación
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setFormat("csv")}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    format === "csv"
                      ? "border-[#7C8F5C] bg-[#7C8F5C]/10"
                      : "border-[#E5DDD1] bg-white hover:border-[#7C8F5C]/50"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">📊</div>
                    <div className="font-medium text-[#2C2621]">CSV</div>
                    <div className="text-xs text-[#6B5E4C]">
                      Excel compatible
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setFormat("json")}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    format === "json"
                      ? "border-[#7C8F5C] bg-[#7C8F5C]/10"
                      : "border-[#E5DDD1] bg-white hover:border-[#7C8F5C]/50"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">🔧</div>
                    <div className="font-medium text-[#2C2621]">JSON</div>
                    <div className="text-xs text-[#6B5E4C]">
                      API compatible
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setFormat("pdf")}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    format === "pdf"
                      ? "border-[#7C8F5C] bg-[#7C8F5C]/10"
                      : "border-[#E5DDD1] bg-white hover:border-[#7C8F5C]/50"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">📄</div>
                    <div className="font-medium text-[#2C2621]">PDF</div>
                    <div className="text-xs text-[#6B5E4C]">
                      Reporte imprimible
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-4">
              <PillButton
                variant="primary"
                onClick={handleExport}
                className="w-full md:w-auto px-8"
              >
                <Download className="w-4 h-4" />
                Exportar Datos
              </PillButton>
            </div>
          </div>
        </BentoCard>

        {/* Info Card */}
        <BentoCard className="p-6 bg-[#7C8F5C]/10 border-2 border-[#7C8F5C]/20">
          <h3 className="text-lg text-[#2C2621] mb-2">
            📌 Información sobre exportación
          </h3>
          <ul className="space-y-1 text-sm text-[#6B5E4C]">
            <li>• El archivo incluirá todos los datos del rango seleccionado</li>
            <li>• Los datos se exportan en formato estándar UTC</li>
            <li>• Las lecturas se muestran en sus unidades originales</li>
            <li>• El límite máximo es de 90 días por exportación</li>
          </ul>
        </BentoCard>
      </div>
    </div>
  );
}