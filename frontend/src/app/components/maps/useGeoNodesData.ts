import { useCallback, useEffect, useRef, useState } from "react";
import { GeoNode, getGeoNodes } from "../../services/nodes";

const MAP_AUTO_REFRESH_MS = 30_000;

export interface UseGeoNodesDataOptions {
  clientId?: number | null;
  propertyId?: number | null;
  areaId?: number | null;
  errorMessage: string;
  /** Limpia la capa actual cuando el fetch falla (admin). */
  clearOnError?: boolean;
}

export function useGeoNodesData(options: UseGeoNodesDataOptions) {
  const [nodes, setNodes] = useState<GeoNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const { clientId, propertyId, areaId, errorMessage, clearOnError = false } = options;

  const refresh = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;
    try {
      setLoading(true);
      setError(null);

      const response = await getGeoNodes({
        per_page: 200,
        include_without_coordinates: true,
        client_id: clientId ?? undefined,
        property_id: propertyId ?? undefined,
        irrigation_area_id: areaId ?? undefined,
      });

      if (requestSeq !== requestSeqRef.current) return;
      setNodes(response.data);
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      console.error("Error fetching geo nodes", err);
      setError(errorMessage);
      if (clearOnError) setNodes([]);
    } finally {
      if (requestSeq !== requestSeqRef.current) return;
      setLoading(false);
    }
  }, [clientId, propertyId, areaId, errorMessage, clearOnError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, MAP_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { nodes, loading, error, refresh };
}

/**
 * Mantiene el nodo seleccionado sincronizado con la lista de nodos:
 * prefiere el nodo del área seleccionada, refresca el objeto y limpia
 * la selección cuando no quedan nodos.
 */
export function useMapSelectedNodeSync(
  nodes: GeoNode[],
  preferredAreaId: number | null | undefined,
  selectedNode: GeoNode | null,
  onSelectNode: (node: GeoNode | null) => void
): void {
  useEffect(() => {
    if (nodes.length === 0) {
      if (selectedNode !== null) {
        onSelectNode(null);
      }
      return;
    }

    const preferredByArea =
      preferredAreaId != null
        ? nodes.find((node) => node.irrigation_area_id === preferredAreaId) || null
        : null;

    if (!selectedNode) {
      onSelectNode(preferredByArea ?? nodes[0]);
      return;
    }

    const latestSelectedNode = nodes.find((node) => node.id === selectedNode.id) || null;
    if (!latestSelectedNode) {
      onSelectNode(preferredByArea ?? nodes[0]);
      return;
    }

    if (preferredByArea && latestSelectedNode.id !== preferredByArea.id) {
      onSelectNode(preferredByArea);
      return;
    }

    if (latestSelectedNode !== selectedNode) {
      onSelectNode(latestSelectedNode);
    }
  }, [nodes, preferredAreaId, selectedNode, onSelectNode]);
}