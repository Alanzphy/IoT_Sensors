import type { ReadingResponse } from "../../../types/api";
import { formatElapsed, parseBackendTimestamp } from "../../../utils/datetime";

export function toCurrentReadings(reading: ReadingResponse | null) {
  const lastUpdate = parseBackendTimestamp(reading?.timestamp);
  return {
    soilHumidity: reading?.soil?.humidity ?? "Sin datos",
    waterFlow: reading?.irrigation?.flow_per_minute ?? "Sin datos",
    accumulatedWater: reading?.irrigation?.accumulated_liters ?? "Sin datos",
    eto: reading?.environmental?.eto ?? "Sin datos",
    irrigationActive: reading?.irrigation?.active ?? null,
    irrigationElapsedTime: formatElapsed(lastUpdate),
    soilConductivity: reading?.soil?.conductivity ?? "Sin datos",
    soilTemp: reading?.soil?.temperature ?? "Sin datos",
    waterPotential: reading?.soil?.water_potential ?? "Sin datos",
    airTemp: reading?.environmental?.temperature ?? "Sin datos",
    relativeHumidity: reading?.environmental?.relative_humidity ?? "Sin datos",
    windSpeed: reading?.environmental?.wind_speed ?? "Sin datos",
    solarRadiation: reading?.environmental?.solar_radiation ?? "Sin datos",
    lastUpdate,
  };
}

export function toChartReadings(readings: ReadingResponse[]) {
  return readings.flatMap((reading) => {
    const fullTime = parseBackendTimestamp(reading.timestamp);
    return fullTime ? [{
      time: fullTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      fullTime,
      soilHumidity: reading.soil?.humidity ?? null,
      waterFlow: reading.irrigation?.flow_per_minute ?? null,
    }] : [];
  }).sort((a, b) => a.fullTime.getTime() - b.fullTime.getTime());
}

export type CurrentReadings = ReturnType<typeof toCurrentReadings>;
export type ChartReading = ReturnType<typeof toChartReadings>[number];
