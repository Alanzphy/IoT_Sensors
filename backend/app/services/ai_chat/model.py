import json
from typing import Any
from urllib import error, request

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import utc_now
from app.models.user import User
from app.services.ai_chat.context import _collect_chat_context, _resolve_scope
from app.services.ai_chat.guardrails import (
    _build_out_of_scope_answer,
    _is_in_scope_question,
)
from app.services.ai_chat.widgets import _build_dynamic_widgets


def _azure_openai_enabled() -> bool:
    return (
        settings.AI_ASSISTANT_ENABLED
        and settings.AZURE_OPENAI_ENABLED
        and bool(settings.AZURE_OPENAI_ENDPOINT)
        and bool(settings.AZURE_OPENAI_API_KEY)
        and bool(settings.AZURE_OPENAI_DEPLOYMENT)
    )
def _call_azure_chat_completion(
    *,
    question: str,
    context_payload: dict[str, Any],
    history: list[dict[str, str]],
) -> tuple[str, dict[str, Any]]:
    endpoint = settings.AZURE_OPENAI_ENDPOINT.rstrip("/")
    url = (
        f"{endpoint}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT}"
        f"/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"
    )

    system_message = (
        "Eres el asistente operativo de una plataforma de riego IoT. "
        "Responde en espanol con tono tecnico claro y accionable. "
        "Usa SOLO el contexto JSON proporcionado. Si falta informacion, dilo de forma explicita. "
        "Prioriza humedad de suelo, flujo de riego, ETO, alertas y frescura de datos. "
        "Incluye cifras concretas cuando existan en el contexto. "
        "Si preguntan por hoy o ayer, usa daily_stats por fecha UTC cuando exista. "
        "Si la pregunta no pertenece al dominio de riego/sensores, rechaza y pide reformular al dominio."
    )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_message},
        {
            "role": "user",
            "content": (
                "Contexto operativo JSON (fuente de verdad para responder):\n"
                f"{json.dumps(context_payload, ensure_ascii=True, default=str)}"
            ),
        },
    ]
    messages.extend(history)
    messages.append({"role": "user", "content": question})

    body = {
        "messages": messages,
        "temperature": settings.AZURE_OPENAI_TEMPERATURE,
        "max_tokens": min(settings.AZURE_OPENAI_MAX_TOKENS, 700),
    }

    req = request.Request(
        url=url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("api-key", settings.AZURE_OPENAI_API_KEY)

    try:
        with request.urlopen(req, timeout=settings.AZURE_OPENAI_TIMEOUT_SECONDS) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Azure OpenAI HTTP {exc.code}: {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"Azure OpenAI request failed: {exc}") from exc

    try:
        data = json.loads(raw)
        answer = str(data["choices"][0]["message"]["content"]).strip()
        if not answer:
            raise ValueError("empty answer")
    except Exception as exc:
        raise RuntimeError(f"Invalid Azure OpenAI response payload: {exc}") from exc

    usage = data.get("usage", {})
    metadata: dict[str, Any] = {
        "provider": "azure-openai",
        "model": data.get("model"),
        "tokens_prompt": usage.get("prompt_tokens"),
        "tokens_completion": usage.get("completion_tokens"),
    }
    return answer, metadata
def _build_fallback_answer(
    *,
    question: str,
    context: dict[str, Any],
) -> str:
    summary = context.get("summary", {})
    stale = summary.get("stale_areas_20m", 0)
    alerts = summary.get("alerts", {})
    areas = context.get("areas", [])

    top_areas = []
    for item in areas[:3]:
        top_areas.append(
            (
                f"{item['area_name']} (H={item['latest']['soil_humidity']}, "
                f"F={item['latest']['flow_per_minute']}, ETO={item['latest']['eto']}, "
                f"frescura={item['freshness_minutes']}m)"
            )
        )
    top_text = "; ".join(top_areas) if top_areas else "Sin areas con telemetria"

    return (
        "No pude usar Azure OpenAI en este momento, pero te comparto contexto operativo:\n"
        f"1. Ventana analizada: {context['window']['hours_back']}h. "
        f"Alertas total={alerts.get('total', 0)} (criticas={alerts.get('critical', 0)}, "
        f"warning={alerts.get('warning', 0)}, no leidas={alerts.get('unread', 0)}).\n"
        f"2. Areas con posible inactividad (>=20 min sin dato): {stale}.\n"
        f"3. Estado rapido de areas: {top_text}.\n"
        "4. Recomendacion: prioriza revisar las areas con menor humedad, alto ETO y "
        "alertas criticas/inactividad; valida las siguientes 2-3 lecturas antes de ajustar riego."
    )
def ask_ai_assistant(
    db: Session,
    *,
    current_user: User,
    message: str,
    history: list[dict[str, str]],
    hours_back: int,
    client_id: int | None,
    irrigation_area_id: int | None,
) -> dict[str, Any]:
    normalized_history = [
        {
            "role": item["role"],
            "content": item["content"].strip(),
        }
        for item in history[-settings.AI_ASSISTANT_MAX_HISTORY_MESSAGES :]
        if item["role"] in ("user", "assistant") and item["content"].strip()
    ]

    scope = _resolve_scope(
        db,
        current_user=current_user,
        client_id=client_id,
        irrigation_area_id=irrigation_area_id,
    )

    generated_at = utc_now()
    if not _is_in_scope_question(message, normalized_history):
        return {
            "answer": _build_out_of_scope_answer(),
            "source": "fallback",
            "generated_at": generated_at,
            "metadata": {
                "provider": "rules-guardrail",
                "scope": scope,
                "hours_back": hours_back,
                "reason": "out_of_scope_question",
            },
            "widgets": [],
        }

    context = _collect_chat_context(
        db,
        current_user=current_user,
        scope=scope,
        hours_back=hours_back,
    )
    widgets = _build_dynamic_widgets(question=message, context=context)

    if _azure_openai_enabled():
        try:
            answer, metadata = _call_azure_chat_completion(
                question=message,
                context_payload=context,
                history=normalized_history,
            )
            metadata["scope"] = scope
            metadata["hours_back"] = hours_back
            metadata["context_counts"] = context.get("summary", {})
            return {
                "answer": answer,
                "source": "ai",
                "generated_at": generated_at,
                "metadata": metadata,
                "widgets": widgets,
            }
        except Exception as exc:
            answer = _build_fallback_answer(question=message, context=context)
            return {
                "answer": answer,
                "source": "fallback",
                "generated_at": generated_at,
                "metadata": {
                    "provider": "rules-fallback",
                    "error_detail": str(exc)[:1200],
                    "scope": scope,
                    "hours_back": hours_back,
                    "context_counts": context.get("summary", {}),
                },
                "widgets": widgets,
            }

    answer = _build_fallback_answer(question=message, context=context)
    return {
        "answer": answer,
        "source": "fallback",
        "generated_at": generated_at,
        "metadata": {
            "provider": "rules-fallback",
            "scope": scope,
            "hours_back": hours_back,
            "context_counts": context.get("summary", {}),
            "reason": "azure_openai_disabled",
        },
        "widgets": widgets,
    }
