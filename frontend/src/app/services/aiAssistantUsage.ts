import { api } from "./api";

export interface AIAssistantUsageItem {
  id: number;
  created_at: string;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  source: string | null;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  status_code: number | null;
  error_detail: string | null;
  client_id: number | null;
  irrigation_area_id: number | null;
  hours_back: number | null;
}

export interface AIAssistantUsageSummary {
  total_requests: number;
  successful_requests: number;
  ai_responses: number;
  fallback_responses: number;
  error_requests: number;
  rate_limited_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  avg_latency_ms: number | null;
}

export interface AIAssistantUsageResponse {
  page: number;
  per_page: number;
  total: number;
  window_hours: number;
  summary: AIAssistantUsageSummary;
  data: AIAssistantUsageItem[];
}

export interface AIAssistantUsageQuery {
  page?: number;
  per_page?: number;
  hours?: number;
  user_id?: number;
  action?: string;
}

export async function getAIAssistantUsage(
  params: AIAssistantUsageQuery = {},
): Promise<AIAssistantUsageResponse> {
  const response = await api.get<AIAssistantUsageResponse>("/ai-assistant/usage", { params });
  return response.data;
}
