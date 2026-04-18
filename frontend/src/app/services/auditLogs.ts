import { api } from "./api";

export interface AuditLogUser {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "cliente";
}

export interface AuditLogItem {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
  user: AuditLogUser | null;
}

export interface AuditLogsPaginatedResponse {
  page: number;
  per_page: number;
  total: number;
  data: AuditLogItem[];
}

export interface ListAuditLogsParams {
  page?: number;
  per_page?: number;
  user_id?: number;
  action?: string;
  entity?: string;
  start_date?: string;
  end_date?: string;
}

export async function listAuditLogs(
  params: ListAuditLogsParams,
): Promise<AuditLogsPaginatedResponse> {
  const response = await api.get<AuditLogsPaginatedResponse>("/audit-logs", { params });
  return response.data;
}

export async function getAuditLog(logId: number): Promise<AuditLogItem> {
  const response = await api.get<AuditLogItem>(`/audit-logs/${logId}`);
  return response.data;
}
