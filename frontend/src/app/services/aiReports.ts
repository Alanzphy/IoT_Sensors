import { api } from "./api";

export type AIReportStatus = "pending" | "processing" | "completed" | "failed";

export interface AIReportItem {
  id: number;
  client_id: number;
  irrigation_area_id: number | null;
  range_start: string;
  range_end: string;
  status: AIReportStatus;
  summary: string | null;
  findings: string | null;
  recommendation: string | null;
  generation_metadata: string | null;
  error_detail: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIReportsPaginatedResponse {
  page: number;
  per_page: number;
  total: number;
  data: AIReportItem[];
}

export interface ListAIReportsParams {
  page?: number;
  per_page?: number;
  client_id?: number;
  irrigation_area_id?: number;
  status?: AIReportStatus;
  start_date?: string;
  end_date?: string;
}

export async function listAIReports(
  params: ListAIReportsParams,
): Promise<AIReportsPaginatedResponse> {
  const response = await api.get<AIReportsPaginatedResponse>("/ai-reports", { params });
  return response.data;
}

export async function getAIReport(reportId: number): Promise<AIReportItem> {
  const response = await api.get<AIReportItem>(`/ai-reports/${reportId}`);
  return response.data;
}
