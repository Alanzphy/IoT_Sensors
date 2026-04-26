import { Bot, Loader2, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { isAxiosError } from "axios";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { askAIAssistant, AIChatMessage } from "../../services/aiAssistant";

interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  generatedAt?: string;
  provider?: string;
  model?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
}

function formatDateTime(isoValue?: string): string {
  if (!isoValue) return "";
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AIChatPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hoursBack, setHoursBack] = useState(72);
  const [clientIdScope, setClientIdScope] = useState("");
  const [areaIdScope, setAreaIdScope] = useState("");
  const streamTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const contextHint = useMemo(() => {
    if (isAdmin) {
      return "Consulta operativa global o por cliente/área.";
    }
    return "Consulta operativa de tus predios y áreas.";
  }, [isAdmin]);

  const resetConversation = () => {
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setIsStreaming(false);
    setMessages([]);
    setErrorMessage(null);
  };

  useEffect(() => {
    return () => {
      if (streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, loading, isStreaming]);

  const streamAssistantText = (messageId: string, fullText: string) => {
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    if (!fullText) {
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);
    let index = 0;
    const totalLength = fullText.length;

    streamTimerRef.current = window.setInterval(() => {
      const remaining = totalLength - index;
      const step =
        remaining > 1000 ? 30 : remaining > 600 ? 20 : remaining > 300 ? 12 : 6;
      index = Math.min(totalLength, index + step);
      const partial = fullText.slice(0, index);

      setMessages((previous) =>
        previous.map((item) =>
          item.id === messageId ? { ...item, content: partial } : item
        )
      );

      if (index >= totalLength) {
        if (streamTimerRef.current !== null) {
          window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        setIsStreaming(false);
      }
    }, 26);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const userText = input.trim();
    if (!userText || loading || isStreaming) return;

    const userMessage: ChatBubble = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setErrorMessage(null);

    const history: AIChatMessage[] = nextMessages.slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    try {
      const response = await askAIAssistant({
        message: userText,
        history,
        hours_back: hoursBack,
        client_id: isAdmin && clientIdScope ? Number(clientIdScope) : undefined,
        irrigation_area_id: areaIdScope ? Number(areaIdScope) : undefined,
      });

      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        source: response.source,
        generatedAt: response.generated_at,
        provider:
          typeof response.metadata.provider === "string"
            ? response.metadata.provider
            : undefined,
        model:
          typeof response.metadata.model === "string"
            ? response.metadata.model
            : undefined,
        tokensPrompt:
          typeof response.metadata.tokens_prompt === "number"
            ? response.metadata.tokens_prompt
            : undefined,
        tokensCompletion:
          typeof response.metadata.tokens_completion === "number"
            ? response.metadata.tokens_completion
            : undefined,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      streamAssistantText(assistantMessage.id, response.answer);
    } catch (error) {
      console.error("Failed to send AI assistant message", error);
      if (isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === "string" && detail.trim()) {
          setErrorMessage(`Error del asistente IA: ${detail}`);
        } else if (Array.isArray(detail) && detail.length > 0) {
          const first = detail[0];
          const msg = typeof first?.msg === "string" ? first.msg : null;
          setErrorMessage(
            msg
              ? `Error del asistente IA: ${msg}`
              : "No fue posible obtener respuesta del asistente IA."
          );
        } else if (error.response?.status) {
          setErrorMessage(`Error del asistente IA: HTTP ${error.response.status}.`);
        } else {
          setErrorMessage("No fue posible obtener respuesta del asistente IA.");
        }
      } else {
        setErrorMessage("No fue posible obtener respuesta del asistente IA.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">
            Asistente IA
          </h1>
          <p className="text-[var(--text-subtle)]">{contextHint}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <BentoCard variant="light">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-subtle)]">
                  Ventana de análisis
                </label>
                <select
                  value={hoursBack}
                  onChange={(event) => setHoursBack(Number(event.target.value))}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
                >
                  <option value={24}>Últimas 24 horas</option>
                  <option value={72}>Últimas 72 horas</option>
                  <option value={168}>Últimos 7 días</option>
                </select>
              </div>

              {isAdmin && (
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-subtle)]">
                    Cliente ID (opcional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={clientIdScope}
                    onChange={(event) => setClientIdScope(event.target.value)}
                    placeholder="Todos"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-[var(--text-subtle)]">
                  Área ID (opcional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={areaIdScope}
                  onChange={(event) => setAreaIdScope(event.target.value)}
                  placeholder="Todas"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
                />
              </div>

              <button
                type="button"
                onClick={resetConversation}
                className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
              >
                Reiniciar conversación
              </button>
            </div>
          </BentoCard>

          <BentoCard variant="light" className="flex min-h-[66vh] flex-col">
            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-subtle)]">
              <Bot className="h-4 w-4" />
              Chat operativo con datos del sistema
            </div>

            <div
              ref={chatScrollRef}
              className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3"
            >
              {messages.length === 0 ? (
                <div className="text-sm text-[var(--text-subtle)]">
                  Escribe una consulta, por ejemplo: “¿Qué áreas están con riesgo de
                  inactividad y cuál priorizo hoy?”
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      className={`rounded-xl border px-3 py-2 ${
                        isUser
                          ? "ml-auto max-w-[85%] border-[var(--accent-primary)]/30 bg-[var(--accent-gold-glow)]"
                          : "mr-auto max-w-[95%] border-[var(--border-subtle)] bg-[var(--surface-app)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm text-[var(--text-body)]">
                        {message.content}
                      </p>
                      {!isUser && (
                        <div className="mt-2 text-xs text-[var(--text-subtle)]">
                          Fuente: {message.source === "ai" ? "IA" : "Fallback"}{" "}
                          {message.provider ? `· ${message.provider}` : ""}
                          {message.model ? `· ${message.model}` : ""}
                          {typeof message.tokensPrompt === "number"
                            ? `· in:${message.tokensPrompt}`
                            : ""}
                          {typeof message.tokensCompletion === "number"
                            ? ` out:${message.tokensCompletion}`
                            : ""}
                          {message.generatedAt ? ` · ${formatDateTime(message.generatedAt)}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {loading && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3 py-2 text-sm text-[var(--text-subtle)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando respuesta...
                </div>
              )}

              {isStreaming && !loading && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3 py-2 text-sm text-[var(--text-subtle)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Escribiendo...
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger)]">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe tu pregunta..."
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-sm text-[var(--text-body)]"
              />
              <button
                type="submit"
                disabled={loading || isStreaming || !input.trim()}
                className="inline-flex h-fit items-center gap-2 rounded-full bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? "Pensando..." : isStreaming ? "Escribiendo..." : "Enviar"}
              </button>
            </form>
          </BentoCard>
        </div>
      </div>
    </PageTransition>
  );
}
