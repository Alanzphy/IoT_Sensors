import { MapPin, RefreshCw, TriangleAlert } from "lucide-react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import {
  communicationStatusClass,
  communicationStatusLabel,
  fitMapToNodes,
  freshnessText,
  removeClusterLayers,
  renderNodeLayer,
} from "../../components/maps/mapHelpers";
import { useGeoNodesData, useMapSelectedNodeSync } from "../../components/maps/useGeoNodesData";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { GeoNode } from "../../services/nodes";
import { parseBackendTimestamp } from "../../utils/datetime";

const DEFAULT_LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_DARK_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface ClientOption {
  id: number;
  company_name: string;
}

interface PropertyOption {
  id: number;
  name: string;
}

interface AreaOption {
  id: number;
  name: string;
}

type ViewMode = "markers" | "clusters";

export function AdminMapPage() {
  const { theme } = useTheme();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

  const [selectedNode, setSelectedNode] = useState<GeoNode | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("markers");
  const [visibleFresh, setVisibleFresh] = useState(true);
  const [visibleStale, setVisibleStale] = useState(true);
  const [visibleNoData, setVisibleNoData] = useState(true);
  const [mapStyleVersion, setMapStyleVersion] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapStyleUrlRef = useRef<string | null>(null);
  const renderCleanupRef = useRef<(() => void) | null>(null);

  const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const lightMapStyleUrl = runtimeEnv?.VITE_MAP_STYLE_URL || DEFAULT_LIGHT_STYLE_URL;
  const darkMapStyleUrl = runtimeEnv?.VITE_MAP_DARK_STYLE_URL || DEFAULT_DARK_STYLE_URL;
  const activeMapStyleUrl = theme === "dark" ? darkMapStyleUrl : lightMapStyleUrl;

  const { nodes, loading: loadingNodes, error, refresh: fetchNodes } = useGeoNodesData({
    clientId: selectedClientId,
    propertyId: selectedPropertyId,
    areaId: selectedAreaId,
    errorMessage: "No se pudo cargar la capa geoespacial para administración.",
    clearOnError: true,
  });

  const displayedError = error ?? filterError;

  useMapSelectedNodeSync(nodes, selectedAreaId, selectedNode, setSelectedNode);

  const visibleStatuses = useMemo(() => {
    const list: GeoNode["freshness_status"][] = [];
    if (visibleFresh) list.push("fresh");
    if (visibleStale) list.push("stale");
    if (visibleNoData) list.push("no_data");
    return list;
  }, [visibleFresh, visibleStale, visibleNoData]);

  const nodesWithCoordinates = useMemo(
    () => nodes.filter((node) => node.latitude !== null && node.longitude !== null),
    [nodes]
  );

  const filteredNodesWithCoordinates = useMemo(
    () => nodesWithCoordinates.filter((node) => visibleStatuses.includes(node.freshness_status)),
    [nodesWithCoordinates, visibleStatuses]
  );

  const nodesWithoutCoordinates = useMemo(
    () => nodes.filter((node) => node.latitude === null || node.longitude === null),
    [nodes]
  );

  const filteredNodesWithoutCoordinates = useMemo(
    () => nodesWithoutCoordinates.filter((node) => visibleStatuses.includes(node.freshness_status)),
    [nodesWithoutCoordinates, visibleStatuses]
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

  const loadClients = useCallback(async () => {
    const response = await api.get("/clients?per_page=200");
    setClients(response.data.data || []);
  }, []);

  const loadProperties = useCallback(async (clientId: number | null) => {
    const params = new URLSearchParams();
    params.set("per_page", "200");
    if (clientId !== null) {
      params.set("client_id", String(clientId));
    }
    const response = await api.get(`/properties?${params.toString()}`);
    setProperties(response.data.data || []);
  }, []);

  const loadAreas = useCallback(async (propertyId: number | null) => {
    if (propertyId === null) {
      setAreas([]);
      return;
    }
    const response = await api.get(`/irrigation-areas?per_page=200&property_id=${propertyId}`);
    setAreas(response.data.data || []);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoadingFilters(true);
        await loadClients();
        await loadProperties(null);
      } catch (err) {
        console.error("Error bootstrapping admin map filters", err);
        setFilterError("No se pudieron cargar los filtros globales.");
      } finally {
        setLoadingFilters(false);
      }
    };

    bootstrap();
  }, [loadClients, loadProperties]);

  useEffect(() => {
    loadProperties(selectedClientId).catch((err) => {
      console.error("Error loading properties", err);
      setFilterError("No se pudieron cargar los predios para el cliente seleccionado.");
    });
    setSelectedPropertyId(null);
    setSelectedAreaId(null);
    setAreas([]);
  }, [selectedClientId, loadProperties]);

  useEffect(() => {
    loadAreas(selectedPropertyId).catch((err) => {
      console.error("Error loading areas", err);
      setFilterError("No se pudieron cargar las áreas para el predio seleccionado.");
    });
    setSelectedAreaId(null);
  }, [selectedPropertyId, loadAreas]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: activeMapStyleUrl,
      center: [-106.0691, 28.632],
      zoom: 5,
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
      removeClusterLayers(mapRef.current);
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
    renderCleanupRef.current = renderNodeLayer(map, filteredNodesWithCoordinates, {
      enableClusters: viewMode === "clusters",
      includeClientInPopup: true,
      noDataColor: "var(--text-subtle)",
      onSelectNode: setSelectedNode,
    });

    fitMapToNodes(map, filteredNodesWithCoordinates);

    return () => {
      if (mapRef.current) {
        renderCleanupRef.current?.();
        map.getCanvas().style.cursor = "";
      }
      renderCleanupRef.current = null;
    };
  }, [filteredNodesWithCoordinates, mapStyleVersion, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const immediateResize = window.setTimeout(() => map.resize(), 0);
    const delayedResize = window.setTimeout(() => map.resize(), 250);
    return () => {
      window.clearTimeout(immediateResize);
      window.clearTimeout(delayedResize);
    };
  }, [loadingNodes, mapStyleVersion]);

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
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">Mapa Global de Nodos</h1>
        <p className="text-[var(--text-subtle)] mt-1">
          Vista administrativa con filtros por cliente, predio y área para monitoreo geoespacial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="rounded-[20px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-4 lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Cliente
              <select
                disabled={loadingFilters}
                className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-[var(--text-main)] bg-[var(--bg-surface)] disabled:opacity-60"
                value={selectedClientId ?? ""}
                onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todos los clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Predio
              <select
                disabled={loadingFilters}
                className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-[var(--text-main)] bg-[var(--bg-surface)] disabled:opacity-60"
                value={selectedPropertyId ?? ""}
                onChange={(e) => setSelectedPropertyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todos los predios</option>
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
                disabled={selectedPropertyId === null || loadingFilters}
                className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-[var(--text-main)] bg-[var(--bg-surface)] disabled:opacity-60"
                value={selectedAreaId ?? ""}
                onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todas las áreas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <PillButton
                type="button"
                onClick={fetchNodes}
                variant="primary"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar capa
              </PillButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Modo de visualización
              <select
                className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-[var(--text-main)] bg-[var(--bg-surface)]"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
              >
                <option value="markers">Marcadores individuales</option>
                <option value="clusters">Clusters automáticos</option>
              </select>
            </label>

            <div className="flex flex-wrap items-end gap-3 text-sm text-[var(--text-subtle)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[var(--accent-primary)]"
                  checked={visibleFresh}
                  onChange={(e) => setVisibleFresh(e.target.checked)}
                />
                Frescos
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[var(--accent-primary)]"
                  checked={visibleStale}
                  onChange={(e) => setVisibleStale(e.target.checked)}
                />
                Tardíos
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[var(--accent-primary)]"
                  checked={visibleNoData}
                  onChange={(e) => setVisibleNoData(e.target.checked)}
                />
                Sin lectura
              </label>
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
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
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-subtle)]" />
                Sin lectura: {statusCounts.no_data}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--outline-contrast)]" />
                Sin GPS: {filteredNodesWithoutCoordinates.length}
              </span>
            </div>
          </div>

          <div className="relative rounded-[18px] overflow-hidden border border-[var(--border-strong)]">
            <div ref={mapContainerRef} className="h-[52vh] md:h-[60vh] w-full bg-[var(--bg-surface)]" />
            {loadingNodes && (
              <div className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] text-sm">
                Cargando nodos geoespaciales...
              </div>
            )}
          </div>

          {displayedError && (
            <div className="mt-3 rounded-xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] text-[var(--status-danger)] px-4 py-3 text-sm flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" />
              {displayedError}
            </div>
          )}
        </div>

        <aside className="rounded-[20px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-4">
          <h2 className="text-[var(--text-main)] text-lg mb-2">Detalle de nodo</h2>
          {selectedNode ? (
            <div className="space-y-2 text-sm">
              <div className="text-[var(--text-main)] font-medium">{selectedNode.name || `Nodo #${selectedNode.id}`}</div>
              <div className="text-[var(--text-muted)]"><strong>Cliente:</strong> {selectedNode.client_company_name}</div>
              <div className="text-[var(--text-muted)]"><strong>Predio:</strong> {selectedNode.property_name}</div>
              <div className="text-[var(--text-muted)]"><strong>Área:</strong> {selectedNode.irrigation_area_name}</div>
              <div className="text-[var(--text-muted)]"><strong>Cultivo:</strong> {selectedNode.crop_type_name}</div>
              <div className="text-[var(--text-muted)]">
                <strong>Estado (config):</strong>{" "}
                <span className={selectedNode.is_active ? "text-[var(--status-active)]" : "text-[var(--status-danger)]"}>
                  {selectedNode.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="text-[var(--text-muted)]">
                <strong>Comunicación:</strong>{" "}
                <span className={communicationStatusClass(selectedNode.freshness_status)}>
                  {communicationStatusLabel(selectedNode.freshness_status)}
                </span>
              </div>
              <div className="text-[var(--text-muted)]"><strong>Frescura:</strong> {freshnessText(selectedNode)}</div>
              {selectedNodeDate && (
                <div className="text-[var(--text-muted)]">
                  <strong>Última lectura:</strong> {selectedNodeDate.toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No hay nodos para mostrar con los filtros actuales.</p>
          )}

          <div className="mt-4 pt-4 border-t border-[var(--border-strong)]">
            <h3 className="text-[var(--text-main)] font-medium mb-2">Nodos sin GPS</h3>
            {filteredNodesWithoutCoordinates.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Todos los nodos tienen coordenadas.</p>
            ) : (
              <ul className="space-y-2 max-h-[180px] overflow-auto pr-1">
                {filteredNodesWithoutCoordinates.map((node) => (
                  <li key={node.id} className="text-sm text-[var(--text-muted)] rounded-lg bg-[var(--bg-surface)] p-2">
                    <div className="font-medium text-[var(--text-main)]">{node.name || `Nodo #${node.id}`}</div>
                    <div>{node.client_company_name}</div>
                    <div>{node.property_name} / {node.irrigation_area_name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-strong)] text-xs text-[var(--text-muted)] flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5" />
            <span>
              Base cartográfica: OpenFreeMap sobre OpenStreetMap. Estilo renderizado con MapLibre GL JS.
            </span>
          </div>
        </aside>
      </div>
    </div>
    </PageTransition>
  );
}