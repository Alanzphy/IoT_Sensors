// Mock data for the application

export const cropTypes = [
  { id: "nogal", name: "Nogal", description: "Nogal pecanero" },
  { id: "alfalfa", name: "Alfalfa", description: "Forraje de alfalfa" },
  { id: "manzana", name: "Manzana", description: "Manzano golden" },
  { id: "maiz", name: "Maíz", description: "Maíz forrajero" },
  { id: "chile", name: "Chile", description: "Chile jalapeño" },
  { id: "algodon", name: "Algodón", description: "Algodón fibra larga" },
];

export const clients = [
  { id: "1", name: "Agrícola López", email: "info@agricolalopez.mx", phone: "+52 656 123 4567", properties: 3, nodes: 12, status: "active" },
  { id: "2", name: "Rancho El Sol", email: "contacto@ranchoelsol.mx", phone: "+52 656 234 5678", properties: 2, nodes: 8, status: "active" },
  { id: "3", name: "Granja Santa María", email: "admin@granjasm.mx", phone: "+52 656 345 6789", properties: 1, nodes: 4, status: "active" },
];

export const properties = [
  { id: "1", clientId: "1", name: "Rancho Norte", location: "Chihuahua, Chih.", areas: 4, createdDate: "2025-01-15" },
  { id: "2", clientId: "1", name: "Predio Sur", location: "Delicias, Chih.", areas: 3, createdDate: "2025-02-01" },
  { id: "3", clientId: "2", name: "Valle Verde", location: "Camargo, Chih.", areas: 5, createdDate: "2024-12-10" },
];

export const irrigationAreas = [
  { id: "1", predioId: "1", name: "Nogal Norte", cropType: "nogal", size: 12.5, nodeId: "node-1", activeCycle: "2026-1" },
  { id: "2", predioId: "1", name: "Alfalfa Este", cropType: "alfalfa", size: 8.3, nodeId: "node-2", activeCycle: "2026-2" },
  { id: "3", predioId: "1", name: "Manzanar Oeste", cropType: "manzana", size: 15.0, nodeId: "node-3", activeCycle: "2026-3" },
  { id: "4", predioId: "1", name: "Maíz Sur", cropType: "maiz", size: 10.2, nodeId: "node-4", activeCycle: "2026-4" },
];

export const nodes = [
  { 
    id: "node-1", 
    name: "Sensor Nogal-01", 
    serialNumber: "SN-2025-001", 
    apiKey: "demo_api_key_node_1", 
    linkedArea: "Nogal Norte",
    gpsLat: "28.6329",
    gpsLng: "-106.0691",
    status: "active",
    lastReading: new Date(Date.now() - 12 * 60 * 1000) // 12 minutes ago
  },
  { 
    id: "node-2", 
    name: "Sensor Alfalfa-01", 
    serialNumber: "SN-2025-002", 
    apiKey: "demo_api_key_node_2", 
    linkedArea: "Alfalfa Este",
    gpsLat: "28.6350",
    gpsLng: "-106.0710",
    status: "active",
    lastReading: new Date(Date.now() - 25 * 60 * 1000) // 25 minutes ago
  },
  { 
    id: "node-3", 
    name: "Sensor Manzana-01", 
    serialNumber: "SN-2025-003", 
    apiKey: "demo_api_key_node_3", 
    linkedArea: "Manzanar Oeste",
    gpsLat: "28.6300",
    gpsLng: "-106.0650",
    status: "active",
    lastReading: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
  },
  { 
    id: "node-4", 
    name: "Sensor Maíz-01", 
    serialNumber: "SN-2025-004", 
    apiKey: "demo_api_key_node_4", 
    linkedArea: null,
    gpsLat: "28.6280",
    gpsLng: "-106.0720",
    status: "inactive",
    lastReading: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
  },
];

export const cropCycles = [
  { id: "2026-1", areaId: "1", startDate: "2026-02-01", endDate: null, isActive: true },
  { id: "2025-1", areaId: "1", startDate: "2025-03-01", endDate: "2026-01-31", isActive: false },
  { id: "2026-2", areaId: "2", startDate: "2026-01-15", endDate: null, isActive: true },
  { id: "2026-3", areaId: "3", startDate: "2025-11-01", endDate: null, isActive: true },
  { id: "2026-4", areaId: "4", startDate: "2026-02-10", endDate: null, isActive: true },
];

// Generate 24 hours of historical data
export const generateHistoricalData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      fullTime: time,
      soilHumidity: 42 + Math.sin(i / 3) * 8 + Math.random() * 3,
      waterFlow: 7.5 + Math.cos(i / 4) * 2 + Math.random() * 1.5,
      eto: 5 + Math.sin(i / 2) * 0.5 + Math.random() * 0.3,
      soilTemp: 21 + Math.sin(i / 5) * 2 + Math.random() * 1,
      airTemp: 25 + Math.sin((i - 12) / 4) * 5 + Math.random() * 2,
      humidity: 50 + Math.cos(i / 3) * 10 + Math.random() * 5,
    });
  }
  
  return data;
};

// Current sensor readings
export const currentReadings = {
  soilHumidity: 45.6,
  waterFlow: 8.3,
  accumulatedWater: 1250,
  eto: 5.2,
  irrigationActive: true,
  irrigationElapsedTime: "2h 34min",
  soilConductivity: 2.5,
  soilTemp: 22.3,
  waterPotential: -0.8,
  airTemp: 28.1,
  relativeHumidity: 55,
  windSpeed: 12.5,
  solarRadiation: 650,
  lastUpdate: new Date(Date.now() - 12 * 60 * 1000),
};
