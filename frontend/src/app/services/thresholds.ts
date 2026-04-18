import { api } from "./api";

export type ThresholdParameter =
  | "soil.conductivity"
  | "soil.temperature"
  | "soil.humidity"
  | "soil.water_potential"
  | "irrigation.active"
  | "irrigation.accumulated_liters"
  | "irrigation.flow_per_minute"
  | "environmental.temperature"
  | "environmental.relative_humidity"
  | "environmental.wind_speed"
  | "environmental.solar_radiation"
  | "environmental.eto";

export type ThresholdSeverity = "info" | "warning" | "critical";

export interface ThresholdItem {
  id: number;
  irrigation_area_id: number;
  parameter: ThresholdParameter;
  min_value: number | null;
  max_value: number | null;
  severity: ThresholdSeverity;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThresholdsPaginatedResponse {
  page: number;
  per_page: number;
  total: number;
  data: ThresholdItem[];
}

export interface ListThresholdsParams {
  page?: number;
  per_page?: number;
  irrigation_area_id?: number;
  parameter?: ThresholdParameter;
  active?: boolean;
}

export interface ThresholdCreatePayload {
  irrigation_area_id: number;
  parameter: ThresholdParameter;
  min_value?: number | null;
  max_value?: number | null;
  severity?: ThresholdSeverity;
  active?: boolean;
}

export interface ThresholdUpdatePayload {
  irrigation_area_id?: number;
  parameter?: ThresholdParameter;
  min_value?: number | null;
  max_value?: number | null;
  severity?: ThresholdSeverity;
  active?: boolean;
}

export async function listThresholds(
  params: ListThresholdsParams,
): Promise<ThresholdsPaginatedResponse> {
  const response = await api.get<ThresholdsPaginatedResponse>("/thresholds", { params });
  return response.data;
}

export async function createThreshold(
  payload: ThresholdCreatePayload,
): Promise<ThresholdItem> {
  const response = await api.post<ThresholdItem>("/thresholds", payload);
  return response.data;
}

export async function updateThreshold(
  thresholdId: number,
  payload: ThresholdUpdatePayload,
): Promise<ThresholdItem> {
  const response = await api.put<ThresholdItem>(`/thresholds/${thresholdId}`, payload);
  return response.data;
}

export async function deleteThreshold(thresholdId: number): Promise<ThresholdItem> {
  const response = await api.delete<ThresholdItem>(`/thresholds/${thresholdId}`);
  return response.data;
}
