import { ChevronDown } from "lucide-react";
import { MetricSkeletonGrid } from "../../components/MetricSkeleton";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSelection } from "../../context/SelectionContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { api } from "../../services/api";
import { formatElapsed, parseBackendTimestamp } from "../../utils/datetime";
import {
  DASHBOARD_REFRESH_MS,
  defaultSemaphore,
  getConnectionState,
  type PriorityKey,
  type PriorityStatusItem,
  type SemaphoreLevel,
} from "./dashboard/helpers";
export function ClientDashboard() {
  const isMobile = useIsMobile();
  const isPageVisible = usePageVisibility();
  const { user } = useAuth();
  const {
    properties,
    areas,
    selectedProperty,
    selectedArea,
    setSelectedProperty,
    setSelectedArea
  } = useSelection();

  const filteredAreas = selectedProperty
    ? areas.filter(a => a.property_id === selectedProperty.id)
    : [];

  const [currentReadings, setCurrentReadings] = useState({
    soilHumidity: 0 as number | '-',
    waterFlow: 0 as number | '-',
    accumulatedWater: 0 as number | '-',
    eto: 0 as number | '-',
    irrigationActive: false,
    irrigationElapsedTime: "N/A",
    soilConductivity: 0 as number | '-',
    soilTemp: 0 as number | '-',
    waterPotential: 0 as number | '-',
    airTemp: 0 as number | '-',
    relativeHumidity: 0 as number | '-',
    windSpeed: 0 as number | '-',
    solarRadiation: 0 as number | '-',
    lastUpdate: null as Date | null,
  });

  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const hasFetchedInitialRef = useRef(false);
  const [prioritySemaphore, setPrioritySemaphore] = useState<Record<PriorityKey, SemaphoreLevel>>(defaultSemaphore);
  const [loading, setLoading] = useState(false);
  const connectionState = getConnectionState(currentReadings.lastUpdate);

  useEffect(() => {
    if (selectedProperty && filteredAreas.length > 0 && !selectedArea) {
      setSelectedArea(filteredAreas[0]);
    }
  }, [selectedProperty, filteredAreas, selectedArea, setSelectedArea]);

  useEffect(() => {
    // Si cambia el área seleccionada, borramos datos anteriores para que retorne a loading skeleton real
    setHistoricalData([]);
    hasFetchedInitialRef.current = false;
  }, [selectedArea?.id]);

  useEffect(() => {
    // Solo detenemos si no hay área, NO paramos de montar el effect si no estamos en focus.
    if (!selectedArea) return;

    let isMounted = true;
    let inFlight = false;
    const areaId = selectedArea.id;

    const fetchData = async () => {
      // Si ya hay request activo, o la página NO está visible, no solicitamos.
      if (inFlight || !isPageVisible) return;
      inFlight = true;
      // Solo mostrar skeleton si es la primera carga para esta área
      if (!hasFetchedInitialRef.current) {
        setLoading(true);
      }

      try {
        const [latestRes, histRes, priorityRes] = await Promise.all([
          api.get(`/readings/latest?irrigation_area_id=${areaId}`),
          api.get(`/readings?irrigation_area_id=${areaId}&per_page=12`),
          api.get(`/readings/priority-status?irrigation_area_id=${areaId}`),
        ]);

        const latestData = latestRes.data;

        if (isMounted) {
          if (latestData) {
            setCurrentReadings({
              soilHumidity: latestData.soil?.humidity ?? '-',
              waterFlow: latestData.irrigation?.flow_per_minute ?? '-',
              accumulatedWater: latestData.irrigation?.accumulated_liters ?? '-',
              eto: latestData.environmental?.eto ?? '-',
              irrigationActive: latestData.irrigation?.active ?? false,
              irrigationElapsedTime: formatElapsed(parseBackendTimestamp(latestData.timestamp)),
              soilConductivity: latestData.soil?.conductivity ?? '-',
              soilTemp: latestData.soil?.temperature ?? '-',
              waterPotential: latestData.soil?.water_potential ?? '-',
              airTemp: latestData.environmental?.temperature ?? '-',
              relativeHumidity: latestData.environmental?.relative_humidity ?? '-',
              windSpeed: latestData.environmental?.wind_speed ?? '-',
              solarRadiation: latestData.environmental?.solar_radiation ?? '-',
              lastUpdate: parseBackendTimestamp(latestData.timestamp),
            });
          } else {
            setCurrentReadings({
              soilHumidity: '-', waterFlow: '-', accumulatedWater: '-', eto: '-',
              irrigationActive: false, irrigationElapsedTime: "N/A",
              soilConductivity: '-', soilTemp: '-', waterPotential: '-',
              airTemp: '-', relativeHumidity: '-', windSpeed: '-', solarRadiation: '-',
              lastUpdate: null,
            });
          }
        }

        if (isMounted && histRes.data?.data) {
          const rawItems = histRes.data.data;
          const chartData = rawItems.reverse().map((item: any) => {
            const t = parseBackendTimestamp(item.timestamp);
            if (!t) {
              return null;
            }
            return {
              time: t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              fullTime: t,
              soilHumidity: item.soil?.humidity ?? 0,
              waterFlow: item.irrigation?.flow_per_minute ?? 0,
            };
          }).filter(Boolean);
          setHistoricalData(chartData);
        }

        if (isMounted) {
          const items: PriorityStatusItem[] = priorityRes.data?.items ?? [];
          const nextSemaphore: Record<PriorityKey, SemaphoreLevel> = {
            ...defaultSemaphore,
          };

          for (const item of items) {
            if (!(item.parameter in nextSemaphore)) continue;
            const key = item.parameter as PriorityKey;
            if (
              item.level === "optimal" ||
              item.level === "warning" ||
              item.level === "critical"
            ) {
              nextSemaphore[key] = item.level;
            }
          }

          if (isMounted) {
            hasFetchedInitialRef.current = true;
            setPrioritySemaphore(nextSemaphore);
          }
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        inFlight = false;
        if (isMounted) setLoading(false);
      }
    };

    // Llamada inicial (depende de isPageVisible para disparar si se acaba de volver la pestaña visible)
    fetchData();

    const intervalId = window.setInterval(() => {
      // Revisa visibility dentro del refetch en intervalo.
      if (isMounted) fetchData();
    }, DASHBOARD_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [selectedArea, isPageVisible]);


  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl md:text-3xl text-[var(--text-title)]">
              Hola, {user?.nombre || 'Usuario'}
            </h1>
            <p className="text-[var(--text-subtle)]">
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Breadcrumb selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select
              className="appearance-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] py-2 pl-4 pr-10 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              value={selectedProperty?.id ?? ""}
              onChange={(e) => {
                const prop = properties.find(p => p.id === Number(e.target.value));
                setSelectedProperty(prop || null);
                setSelectedArea(null);
              }}
            >
              <option value="" disabled>Seleccione predio...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          </div>

          {(selectedProperty || filteredAreas.length > 0) && (
            <div className="relative">
              <select
                className="appearance-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] py-2 pl-4 pr-10 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                value={selectedArea?.id ?? ""}
                onChange={(e) => {
                  const area = areas.find(a => a.id === Number(e.target.value));
                  setSelectedArea(area || null);
                }}
              >
                <option value="" disabled>Seleccione área...</option>
                {filteredAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            </div>
          )}

          {selectedArea && (
            <>
              {connectionState === "online" && (
                <div className="inline-flex items-center rounded-full border border-[var(--status-active)]/35 bg-[var(--status-active-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-active)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--status-active)] animate-glow-pulse" />
                  En línea
                </div>
              )}
              {connectionState === "warning" && (
                <div className="inline-flex items-center rounded-full border border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-warning)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--status-warning)]" />
                  Sin reporte reciente
                </div>
              )}
              {connectionState === "offline" && (
                <div className="inline-flex items-center rounded-full border border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-danger)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--status-danger)]" />
                  Sin conexión
                </div>
              )}
              {connectionState === "no_data" && (
                <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-subtle)]">
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-[var(--text-muted)]" />
                  Sin lecturas
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bento Grid Layout */}
      {!selectedArea ? null : loading ? (
        <MetricSkeletonGrid count={isMobile ? 3 : 6} />
      ) : isMobile ? (
        <MobileDashboard
          historicalData={historicalData}
          currentReadings={currentReadings}
          prioritySemaphore={prioritySemaphore}
          connectionState={connectionState}
        />
      ) : (
        <DesktopDashboard
          historicalData={historicalData}
          currentReadings={currentReadings}
          prioritySemaphore={prioritySemaphore}
          connectionState={connectionState}
        />
      )}
    </div>
  );
}

import { DesktopDashboard } from "./dashboard/DesktopDashboard";
import { MobileDashboard } from "./dashboard/MobileDashboard";
