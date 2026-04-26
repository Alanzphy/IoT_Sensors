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
}

export async function askAIAssistant(payload: AIChatRequest): Promise<AIChatResponse> {
  const response = await api.post<AIChatResponse>("/ai-assistant/chat", payload);
  return response.data;
}
