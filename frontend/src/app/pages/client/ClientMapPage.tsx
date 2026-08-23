import { MapPin, RefreshCw, TriangleAlert } from "lucide-react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  communicationStatusClass,
  communicationStatusLabel,
  fitMapToNodes,
  freshnessText,
  renderNodeLayer,
} from "../../components/maps/mapHelpers";
import { useGeoNodesData, useMapSelectedNodeSync } from "../../components/maps/useGeoNodesData";
import { useTheme } from "../../context/ThemeContext";
import { useSelection } from "../../context/SelectionContext";
import { GeoNode } from "../../services/nodes";
import { parseBackendTimestamp } from "../../utils/datetime";

const DEFAULT_LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_DARK_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function ClientMapPage() {
  const { theme } = useTheme();

  const {
    properties,
    areas,
    selectedProperty,
    selectedArea,
    setSelectedProperty,
    setSelectedArea,
  } = useSelection();

  const [selectedNode, setSelectedNode] = useState<GeoNode | null>(null);
  const [mapStyleVersion, setMapStyleVersion] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapStyleUrlRef = useRef<string | null>(null);
  const renderCleanupRef = useRef<(() => void) | null>(null);

  const lightMapStyleUrl = import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_LIGHT_STYLE_URL;
  const darkMapStyleUrl = import.meta.env.VITE_MAP_DARK_STYLE_URL || DEFAULT_DARK_STYLE_URL;
  const activeMapStyleUrl = theme === "dark" ? darkMapStyleUrl : lightMapStyleUrl;

  const { nodes, loading, error, refresh: fetchNodes } = useGeoNodesData({
    propertyId: selectedProperty?.id,
    areaId: selectedArea?.id,
    errorMessage: "No se pudo cargar la capa geoespacial. Intenta nuevamente.",
  });

  useMapSelectedNodeSync(nodes, selectedArea?.id, selectedNode, setSelectedNode);

  const filteredAreas = useMemo(() => {
    if (!selectedProperty) return areas;
    return areas.filter((area) => area.property_id === selectedProperty.id);
  }, [areas, selectedProperty]);

  const nodesWithCoordinates = useMemo(
    () => nodes.filter((node) => node.latitude !== null && node.longitude !== null),
    [nodes]
  );

  const nodesWithoutCoordinates = useMemo(
    () => nodes.filter((node) => node.latitude === null || node.longitude === null),
    [nodes]
  );

  const statusCounts = useMemo(() => {
    return nodes.reduce(
      (acc, node) => {
        if (node.freshness_status === "fresh") acc.fresh += 1;
        if (node.freshness_status === "stale") acc.stale += 1;
        if (node.freshness_status === "no_data") acc.no_data += 1;
        return acc;
      },
      { fresh: 0, stale: 0, no_data: 0 }
    );
  }, [nodes]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: activeMapStyleUrl,
      center: [-106.0691, 28.632],
      zoom: 6,
      attributionControl: true as any,
    });
    mapStyleUrlRef.current = activeMapStyleUrl;

    const onStyleLoad = () => {
      setMapStyleVersion((previous) => previous + 1);
      mapRef.current?.off("style.load", onStyleLoad);
    };
    mapRef.current.on("style.load", onStyleLoad);

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      mapRef.current?.off("style.load", onStyleLoad);
      mapRef.current?.remove();
      mapRef.current = null;
      mapStyleUrlRef.current = null;
    };
  }, [activeMapStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mapStyleUrlRef.current === activeMapStyleUrl) return;

    const onStyleLoad = () => {
      setMapStyleVersion((previous) => previous + 1);
      map.off("style.load", onStyleLoad);
    };

    map.on("style.load", onStyleLoad);
    map.setStyle(activeMapStyleUrl);
    mapStyleUrlRef.current = activeMapStyleUrl;

    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [activeMapStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      let cancelled = false;
      const retryRender = () => {
        if (!cancelled) {
          setMapStyleVersion((previous) => previous + 1);
        }
      };
      const onStyleLoad = () => {
        retryRender();
      };
      map.once("style.load", onStyleLoad);
      const retryTimer = window.setTimeout(retryRender, 250);
      return () => {
        cancelled = true;
        window.clearTimeout(retryTimer);
        map.off("style.load", onStyleLoad);
      };
    }

    renderCleanupRef.current?.();
    renderCleanupRef.current = renderNodeLayer(map, nodesWithCoordinates, {
      enableClusters: false,
      includeClientInPopup: false,
      noDataColor: "var(--text-muted)",
      onSelectNode: setSelectedNode,
    });

    fitMapToNodes(map, nodesWithCoordinates);

    return () => {
      if (mapRef.current) {
        renderCleanupRef.current?.();
      }
      renderCleanupRef.current = null;
    };
  }, [mapStyleVersion, nodesWithCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const immediateResize = window.setTimeout(() => map.resize(), 0);
    const delayedResize = window.setTimeout(() => map.resize(), 250);
    return () => {
      window.clearTimeout(immediateResize);
      window.clearTimeout(delayedResize);
    };
  }, [loading, mapStyleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedNode) return;
    if (selectedNode.latitude === null || selectedNode.longitude === null) return;

    map.flyTo({
      center: [selectedNode.longitude, selectedNode.latitude],
      zoom: 13,
      essential: true,
      duration: 700,
    });
  }, [selectedNode?.id]);

  const selectedNodeDate = parseBackendTimestamp(selectedNode?.last_reading_timestamp ?? null);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl text-[var(--text-title)]">Mapa de Nodos</h1>
        <p className="text-[var(--text-subtle)] mt-1">
          Visualiza la ubicación geográfica y frescura de cada nodo IoT en tus áreas de riego.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="rounded-[20px] bg-[var(--surface-panel)] border border-[var(--border-subtle)] p-4 lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Predio
              <select
                className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-[var(--text-body)] bg-[var(--surface-card-primary)]"
                value={selectedProperty?.id ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value ? Number(e.target.value) : null;
                  const nextProperty = properties.find((property) => property.id === nextId) || null;
                  setSelectedProperty(nextProperty);
                  if (!nextProperty) {
                    setSelectedArea(null);
                    return;
                  }
                  const firstArea = areas.find((area) => area.property_id === nextProperty.id) || null;
                  setSelectedArea(firstArea);
                }}
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Área de riego
              <select
                className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-[var(--text-body)] bg-[var(--surface-card-primary)]"
                value={selectedArea?.id ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value ? Number(e.target.value) : null;
                  const nextArea = filteredAreas.find((area) => area.id === nextId) || null;
                  setSelectedArea(nextArea);
                }}
              >
                {filteredAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={fetchNodes}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 bg-[var(--accent-primary)] text-[var(--text-inverted)] hover:opacity-90 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar capa
              </button>
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2.5 text-xs text-[var(--text-subtle)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />
                Fresco: {statusCounts.fresh}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-warning)]" />
                Tardío: {statusCounts.stale}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />
                Sin lectura: {statusCounts.no_data}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF]" />
                Sin GPS: {nodesWithoutCoordinates.length}
              </span>
            </div>
          </div>

          <div className="relative rounded-[18px] overflow-hidden border border-[var(--border-subtle)]">
            <div ref={mapContainerRef} className="h-[52vh] md:h-[60vh] w-full bg-[var(--surface-card-primary)]" />
            {loading && (
              <div className="absolute inset-0 bg-[var(--surface-page)]/80 backdrop-blur-sm flex items-center justify-center text-[var(--text-subtle)] text-sm">
                Cargando nodos geoespaciales...
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] text-[var(--status-danger)] px-4 py-3 text-sm flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <aside className="rounded-[20px] bg-[var(--surface-panel)] border border-[var(--border-subtle)] p-4">
          <h2 className="text-[var(--text-title)] text-lg mb-2">Detalle de nodo</h2>
          {selectedNode ? (
            <div className="space-y-2 text-sm">
              <div className="text-[var(--text-body)] font-medium">{selectedNode.name || `Nodo #${selectedNode.id}`}</div>
              <div className="text-[var(--text-subtle)]"><strong>Predio:</strong> {selectedNode.property_name}</div>
              <div className="text-[var(--text-subtle)]"><strong>Área:</strong> {selectedNode.irrigation_area_name}</div>
              <div className="text-[var(--text-subtle)]"><strong>Cultivo:</strong> {selectedNode.crop_type_name}</div>
              <div className="text-[var(--text-subtle)]">
                <strong>Estado (config):</strong> {selectedNode.is_active ? "Activo" : "Inactivo"}
              </div>
              <div className="text-[var(--text-subtle)]">
                <strong>Comunicación:</strong>{" "}
                <span className={communicationStatusClass(selectedNode.freshness_status)}>
                  {communicationStatusLabel(selectedNode.freshness_status)}
                </span>
              </div>
              <div className="text-[var(--text-subtle)]"><strong>Frescura:</strong> {freshnessText(selectedNode)}</div>
              {selectedNodeDate && (
                <div className="text-[var(--text-subtle)]">
                  <strong>Última lectura:</strong> {selectedNodeDate.toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-subtle)]">No hay nodos para mostrar con los filtros actuales.</p>
          )}

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <h3 className="text-[var(--text-title)] font-medium mb-2">Nodos sin GPS</h3>
            {nodesWithoutCoordinates.length === 0 ? (
              <p className="text-sm text-[var(--text-subtle)]">Todos los nodos tienen coordenadas.</p>
            ) : (
              <ul className="space-y-2">
                {nodesWithoutCoordinates.map((node) => (
                  <li key={node.id} className="text-sm text-[var(--text-subtle)] rounded-lg bg-[var(--surface-card-primary)] p-2">
                    <div className="font-medium text-[var(--text-body)]">{node.name || `Nodo #${node.id}`}</div>
                    <div>{node.property_name} / {node.irrigation_area_name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-subtle)] flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5" />
            <span>
              Base cartográfica: OpenFreeMap sobre OpenStreetMap. Los estilos se renderizan con MapLibre GL JS.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}