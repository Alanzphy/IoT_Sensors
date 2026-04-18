import { api } from "./api";

export interface AlertItem {
  id: number;
  node_id: number;
  irrigation_area_id: number;
  threshold_id: number | null;
  type: "threshold" | "inactivity";
  parameter: string | null;
  detected_value: number | null;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
  read: boolean;
  read_at: string | null;
  notified_email: boolean;
  notified_whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertsPaginatedResponse {
  page: number;
  per_page: number;
  total: number;
  data: AlertItem[];
}

export interface ListAlertsParams {
  page?: number;
  per_page?: number;
  irrigation_area_id?: number;
  node_id?: number;
  severity?: "info" | "warning" | "critical";
  read?: boolean;
  alert_type?: "threshold" | "inactivity";
  start_date?: string;
  end_date?: string;
}

export async function listAlerts(
  params: ListAlertsParams,
): Promise<AlertsPaginatedResponse> {
  const response = await api.get<AlertsPaginatedResponse>("/alerts", { params });
  return response.data;
}

export async function markAlertRead(alertId: number, read = true): Promise<AlertItem> {
  const response = await api.patch<AlertItem>(`/alerts/${alertId}/read`, { read });
  return response.data;
}
