import { api } from "./api";

export type NotificationAlertType = "threshold" | "inactivity";
export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationChannel = "email" | "whatsapp";

export interface NotificationPreferenceItem {
  id: number;
  client_id: number;
  irrigation_area_id: number;
  alert_type: NotificationAlertType;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesPaginatedResponse {
  page: number;
  per_page: number;
  total: number;
  data: NotificationPreferenceItem[];
}

export interface ListNotificationPreferencesParams {
  page?: number;
  per_page?: number;
  irrigation_area_id?: number;
  alert_type?: NotificationAlertType;
  severity?: NotificationSeverity;
  channel?: NotificationChannel;
}

export interface NotificationPreferenceUpsertItem {
  irrigation_area_id: number;
  alert_type: NotificationAlertType;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationPreferenceBulkUpsertResponse {
  created: number;
  updated: number;
  data: NotificationPreferenceItem[];
}

export interface ClientNotificationSettingsResponse {
  notifications_enabled: boolean;
}

export async function listNotificationPreferences(
  params: ListNotificationPreferencesParams,
): Promise<NotificationPreferencesPaginatedResponse> {
  const response = await api.get<NotificationPreferencesPaginatedResponse>(
    "/notification-preferences",
    { params },
  );
  return response.data;
}

export async function bulkUpsertNotificationPreferences(
  items: NotificationPreferenceUpsertItem[],
): Promise<NotificationPreferenceBulkUpsertResponse> {
  const response = await api.put<NotificationPreferenceBulkUpsertResponse>(
    "/notification-preferences/bulk",
    { items },
  );
  return response.data;
}

export async function getMyNotificationSettings(): Promise<ClientNotificationSettingsResponse> {
  const response = await api.get<ClientNotificationSettingsResponse>(
    "/clients/me/notification-settings",
  );
  return response.data;
}

export async function updateMyNotificationSettings(
  notificationsEnabled: boolean,
): Promise<ClientNotificationSettingsResponse> {
  const response = await api.patch<ClientNotificationSettingsResponse>(
    "/clients/me/notification-settings",
    { notifications_enabled: notificationsEnabled },
  );
  return response.data;
}
