import { MapPin, RefreshCw, TriangleAlert } from "lucide-react";
import maplibregl, { LngLatBoundsLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelection } from "../../context/SelectionContext";
import { GeoNode, getGeoNodes } from "../../services/nodes";

const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function markerColorByStatus(status: GeoNode["freshness_status"]): string {
  if (status === "fresh") return "#6D7E5E";
  if (status === "stale") return "#D97706";
  return "#6E6359";
}

function freshnessText(node: GeoNode): string {
  if (node.minutes_since_last_reading === null) {
    return "Sin lecturas";
  }
  if (node.minutes_since_last_reading < 60) {
    return `Hace ${node.minutes_since_last_reading} min`;
  }
  const hours = Math.floor(node.minutes_since_last_reading / 60);
  const mins = node.minutes_since_last_reading % 60;
  return `Hace ${hours}h ${mins}min`;
}

export function ClientMapPage() {
  const {
    properties,
    areas,
    selectedProperty,
    selectedArea,
    setSelectedProperty,
    setSelectedArea,
  } = useSelection();

  const [nodes, setNodes] = useState<GeoNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GeoNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

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

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getGeoNodes({
        per_page: 200,
        include_without_coordinates: true,
        property_id: selectedProperty?.id,
        irrigation_area_id: selectedArea?.id,
      });
      setNodes(response.data);
    } catch (err) {
      console.error("Error fetching geo nodes", err);
      setError("No se pudo cargar la capa geoespacial. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [selectedProperty?.id, selectedArea?.id]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  useEffect(() => {
    if (!selectedNode && nodes.length > 0) {
      setSelectedNode(nodes[0]);
      return;
    }
    if (selectedNode && !nodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(nodes.length > 0 ? nodes[0] : null);
    }
  }, [nodes, selectedNode]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE_URL,
      center: [-106.0691, 28.632],
      zoom: 6,
      attributionControl: true,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const node of nodesWithCoordinates) {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = "w-4 h-4 rounded-full border-2 border-white shadow-md";
      markerElement.style.backgroundColor = markerColorByStatus(node.freshness_status);
      markerElement.title = node.name || `Nodo #${node.id}`;

      const popupHtml = `
        <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: 700; color: #2C2621; margin-bottom: 4px;">${node.name || `Nodo #${node.id}`}</div>
          <div><strong>Predio:</strong> ${node.property_name}</div>
          <div><strong>Área:</strong> ${node.irrigation_area_name}</div>
          <div><strong>Cultivo:</strong> ${node.crop_type_name}</div>
          <div><strong>Frescura:</strong> ${freshnessText(node)}</div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([node.longitude as number, node.latitude as number])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(popupHtml))
        .addTo(mapRef.current);

      markerElement.addEventListener("click", () => setSelectedNode(node));
      markersRef.current.push(marker);
    }

    if (nodesWithCoordinates.length === 1) {
      const oneNode = nodesWithCoordinates[0];
      mapRef.current.flyTo({
        center: [oneNode.longitude as number, oneNode.latitude as number],
        zoom: 12,
        essential: true,
      });
      return;
    }

    if (nodesWithCoordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      nodesWithCoordinates.forEach((node) => {
        bounds.extend([node.longitude as number, node.latitude as number]);
      });
      mapRef.current.fitBounds(bounds as LngLatBoundsLike, {
        padding: 60,
        maxZoom: 13,
        duration: 700,
      });
    }
  }, [nodesWithCoordinates]);

  const selectedNodeDate = selectedNode?.last_reading_timestamp
    ? new Date(selectedNode.last_reading_timestamp)
    : null;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl text-[#2C2621]">Mapa de Nodos</h1>
        <p className="text-[#6E6359] mt-1">
          Visualiza la ubicación geográfica y frescura de cada nodo IoT en tus áreas de riego.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="rounded-[20px] bg-white border border-[#2C2621]/10 p-4 lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-sm text-[#6E6359]">
              Predio
              <select
                className="rounded-xl border border-[#2C2621]/20 px-3 py-2 text-[#2C2621] bg-[#F9F8F4]"
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

            <label className="flex flex-col gap-1 text-sm text-[#6E6359]">
              Área de riego
              <select
                className="rounded-xl border border-[#2C2621]/20 px-3 py-2 text-[#2C2621] bg-[#F9F8F4]"
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
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-[#6D7E5E] text-[#F4F1EB] hover:opacity-90 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar capa
              </button>
            </div>
          </div>

          <div className="relative rounded-[18px] overflow-hidden border border-[#2C2621]/10">
            <div ref={mapContainerRef} className="h-[52vh] md:h-[60vh] w-full bg-[#E6E1D8]" />
            {loading && (
              <div className="absolute inset-0 bg-[#F4F1EB]/80 backdrop-blur-sm flex items-center justify-center text-[#6E6359] text-sm">
                Cargando nodos geoespaciales...
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <aside className="rounded-[20px] bg-white border border-[#2C2621]/10 p-4">
          <h2 className="text-[#2C2621] text-lg mb-2">Detalle de nodo</h2>
          {selectedNode ? (
            <div className="space-y-2 text-sm">
              <div className="text-[#2C2621] font-medium">{selectedNode.name || `Nodo #${selectedNode.id}`}</div>
              <div className="text-[#6E6359]"><strong>Predio:</strong> {selectedNode.property_name}</div>
              <div className="text-[#6E6359]"><strong>Área:</strong> {selectedNode.irrigation_area_name}</div>
              <div className="text-[#6E6359]"><strong>Cultivo:</strong> {selectedNode.crop_type_name}</div>
              <div className="text-[#6E6359]"><strong>Estado:</strong> {selectedNode.is_active ? "Activo" : "Inactivo"}</div>
              <div className="text-[#6E6359]"><strong>Frescura:</strong> {freshnessText(selectedNode)}</div>
              {selectedNodeDate && (
                <div className="text-[#6E6359]">
                  <strong>Última lectura:</strong> {selectedNodeDate.toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#6E6359]">No hay nodos para mostrar con los filtros actuales.</p>
          )}

          <div className="mt-4 pt-4 border-t border-[#2C2621]/10">
            <h3 className="text-[#2C2621] font-medium mb-2">Nodos sin GPS</h3>
            {nodesWithoutCoordinates.length === 0 ? (
              <p className="text-sm text-[#6E6359]">Todos los nodos tienen coordenadas.</p>
            ) : (
              <ul className="space-y-2">
                {nodesWithoutCoordinates.map((node) => (
                  <li key={node.id} className="text-sm text-[#6E6359] rounded-lg bg-[#F9F8F4] p-2">
                    <div className="font-medium text-[#2C2621]">{node.name || `Nodo #${node.id}`}</div>
                    <div>{node.property_name} / {node.irrigation_area_name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#2C2621]/10 text-xs text-[#6E6359] flex items-start gap-2">
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
