import { api } from "./api";

export type AIChatMessageRole = "user" | "assistant";

export interface AIChatMessage {
  role: AIChatMessageRole;
  content: string;
}

export interface AIChatRequest {
  message: string;
  history?: AIChatMessage[];
  hours_back?: number;
  client_id?: number;
  irrigation_area_id?: number;
}

export interface AIChatResponse {
  answer: string;
  source: "ai" | "fallback";
  generated_at: string;
  metadata: Record<string, unknown>;
  widgets?: AIChatWidget[];
}

export type AIChatWidgetType = "kpi_cards" | "table" | "line_chart";

export interface AIChatWidget {
  type: AIChatWidgetType;
  title?: string;
  items?: Array<{
    key?: string;
    label: string;
    value: string | number | null;
  }>;
  columns?: Array<{
    key: string;
    label: string;
  }>;
  rows?: Array<Record<string, string | number | null>>;
  x_key?: string;
  series?: Array<{
    key: string;
    label: string;
    color?: string;
  }>;
  data?: Array<Record<string, string | number | null>>;
}

export async function askAIAssistant(payload: AIChatRequest): Promise<AIChatResponse> {
  const response = await api.post<AIChatResponse>("/ai-assistant/chat", payload);
  return response.data;
}
