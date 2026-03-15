import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

export interface Property {
  id: number;
  client_id: number;
  name: string;
  location: string | null;
}

export interface CropTypeBrief {
  id: number;
  name: string;
}

export interface IrrigationArea {
  id: number;
  property_id: number;
  crop_type_id: number;
  name: string;
  area_size: number | null;
  crop_type: CropTypeBrief | null;
}

interface SelectionContextType {
  properties: Property[];
  areas: IrrigationArea[];
  selectedProperty: Property | null;
  selectedArea: IrrigationArea | null;
  setSelectedProperty: (property: Property | null) => void;
  setSelectedArea: (area: IrrigationArea | null) => void;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedArea, setSelectedArea] = useState<IrrigationArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all properties (API handles filtering by client context)
      const propsRes = await api.get("/properties?per_page=100");
      const fetchedProperties = propsRes.data.data;
      setProperties(fetchedProperties);

      // Fetch all areas
      const areasRes = await api.get("/irrigation-areas?per_page=100");
      const fetchedAreas = areasRes.data.data;
      setAreas(fetchedAreas);

      // If we have properties and no selected property, select the first one.
      if (fetchedProperties.length > 0 && !selectedProperty) {
        setSelectedProperty(fetchedProperties[0]);
        // And automatically select the first area for that property
        const matchedArea = fetchedAreas.find((a: IrrigationArea) => a.property_id === fetchedProperties[0].id);
        if (matchedArea && !selectedArea) {
          setSelectedArea(matchedArea);
        }
      }
    } catch (err: any) {
      console.error("Error fetching selection data:", err);
      setError("No se pudieron cargar las propiedades o áreas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if authenticated. The caller (ClientLayout) should be inside ProtectedRoute.
    fetchData();
  }, []);

  // Whenever the selected property changes, try to pick an area for it if it doesn't match
  useEffect(() => {
    if (selectedProperty && areas.length > 0) {
      if (!selectedArea || selectedArea.property_id !== selectedProperty.id) {
        const firstArea = areas.find(a => a.property_id === selectedProperty.id);
        if (firstArea) {
          setSelectedArea(firstArea);
        } else {
          setSelectedArea(null); // No areas matched this property
        }
      }
    }
  }, [selectedProperty, areas]);

  return (
    <SelectionContext.Provider
      value={{
        properties,
        areas,
        selectedProperty,
        selectedArea,
        setSelectedProperty,
        setSelectedArea,
        loading,
        error,
        refreshData: fetchData,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
