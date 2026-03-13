import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { generateHistoricalData } from "../../data/mockData";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useIsMobile } from "../../hooks/useIsMobile";

export function HistoricalData() {
  const [dateRange, setDateRange] = useState("Semana");
  const [category, setCategory] = useState("Todo");
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();

  const historicalData = generateHistoricalData();

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">Datos Históricos</h1>
        <p className="text-[#6E6359]">Consulta el histórico de lecturas de tus sensores</p>
      </div>

      {/* Filters */}
      <BentoCard variant="light" className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-[#6E6359] mb-2">Rango de fechas</label>
            <div className="flex gap-2">
              {["Semana", "Mes", "Año"].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-full transition-all ${
                    dateRange === range
                      ? "bg-[#6D7E5E] text-[#F4F1EB]"
                      : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm text-[#6E6359] mb-2">Ciclo de cultivo</label>
            <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] text-[#2C2621] hover:bg-[#E2D4B7]/30 transition-colors">
              <span>Ciclo 2026 (Feb-actual)</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1">
            <label className="block text-sm text-[#6E6359] mb-2">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {["Todo", "Suelo", "Riego", "Ambiental"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    category === cat
                      ? "bg-[#6D7E5E] text-[#F4F1EB]"
                      : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm text-[#6E6359] mb-2">Fecha inicio</label>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] text-[#2C2621]">
              <Calendar className="w-5 h-5 text-[#6E6359]" />
              <span>20 Feb 2026</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#6E6359] mb-2">Fecha fin</label>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-[24px] bg-[#F4F1EB] text-[#2C2621]">
              <Calendar className="w-5 h-5 text-[#6E6359]" />
              <span>26 Feb 2026</span>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* Multi-line Chart */}
      <BentoCard variant="light" className="mb-6">
        <h3 className="text-lg text-[#2C2621] mb-6">Gráfica de Métricas</h3>
        <div className="h-[400px] min-h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" />
              <XAxis 
                dataKey="time" 
                stroke="#6E6359"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6E6359"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#F9F8F4', 
                  border: '1px solid #E6E1D8',
                  borderRadius: '16px',
                  padding: '12px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="soilHumidity" 
                name="Humedad suelo (%)"
                stroke="#6D7E5E" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="waterFlow" 
                name="Flujo agua (L/min)"
                stroke="#A68A61" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="soilTemp" 
                name="Temp. suelo (°C)"
                stroke="#705541" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="airTemp" 
                name="Temp. aire (°C)"
                stroke="#E2D4B7" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      {/* Data Table */}
      <BentoCard variant="light">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-[#2C2621]">Tabla de Datos</h3>
          <PillButton variant="secondary" className="text-sm">
            Exportar CSV
          </PillButton>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[#2C2621]/10">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Fecha/Hora</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Humedad (%)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Flujo (L/min)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Temp. Suelo (°C)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">Temp. Aire (°C)</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6E6359]">H. Relativa (%)</th>
              </tr>
            </thead>
            <tbody>
              {historicalData.slice(0, 10).map((row, i) => (
                <tr 
                  key={i}
                  className={i % 2 === 0 ? "bg-[#F4F1EB]/30" : ""}
                >
                  <td className="py-3 px-4 text-sm text-[#2C2621]">
                    {row.fullTime.toLocaleString('es-MX', { 
                      day: '2-digit', 
                      month: 'short', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {row.soilHumidity.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {row.waterFlow.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {row.soilTemp.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {row.airTemp.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#2C2621] font-medium">
                    {row.humidity.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              className={`w-10 h-10 rounded-full transition-all ${
                page === 1
                  ? "bg-[#6D7E5E] text-[#F4F1EB]"
                  : "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}