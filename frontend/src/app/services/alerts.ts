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
  ai_recommendation: string | null;
  ai_recommendation_error: string | null;
  ai_recommendation_generated_at: string | null;
  ai_recommendation_metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertRecommendationResponse {
  alert_id: number;
  recommendation: string;
  source: "ai" | "fallback" | "cached_ai" | "cached_fallback";
  generated_at: string | null;
  error_detail: string | null;
}

export interface AlertsPaginatedResponse {
  page: number;
  per_page: number;
  total: number;
  data: AlertItem[];
}

export interface AlertUnreadCountResponse {
  unread_count: number;
}

export interface AlertBulkReadResponse {
  updated_count: number;
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
  const response = await api.get<AlertsPaginatedResponse>("/alerts", {
    params: {
      ...params,
      _ts: Date.now(),
    },
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  return response.data;
}

export async function getAlert(alertId: number): Promise<AlertItem> {
  const response = await api.get<AlertItem>(`/alerts/${alertId}`);
  return response.data;
}

export async function markAlertRead(alertId: number, read = true): Promise<AlertItem> {
  const response = await api.patch<AlertItem>(`/alerts/${alertId}/read`, { read });
  return response.data;
}

export async function markAllAlertsRead(
  params?: Omit<ListAlertsParams, "page" | "per_page" | "read">,
): Promise<number> {
  const response = await api.post<AlertBulkReadResponse>("/alerts/read-all", null, {
    params,
  });
  return response.data.updated_count ?? 0;
}

export async function generateAlertRecommendation(
  alertId: number,
  force = false,
): Promise<AlertRecommendationResponse> {
  const response = await api.post<AlertRecommendationResponse>(
    `/alerts/${alertId}/recommendation`,
    { force },
  );
  return response.data;
}

export async function getUnreadAlertsCount(
  params?: Omit<ListAlertsParams, "page" | "per_page" | "read">,
): Promise<number> {
  const response = await api.get<AlertUnreadCountResponse>("/alerts/unread-count", {
    params: {
      ...(params || {}),
      _ts: Date.now(),
    },
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  return response.data.unread_count ?? 0;
}
