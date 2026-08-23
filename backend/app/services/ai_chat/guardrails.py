import re
import unicodedata


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return without_accents.lower().strip()
def _contains_domain_terms(text: str) -> bool:
    terms = (
        "riego",
        "sensor",
        "sensores",
        "humedad",
        "suelo",
        "eto",
        "evapotranspir",
        "flujo",
        "litros",
        "nodo",
        "nodos",
        "alerta",
        "alertas",
        "predio",
        "predios",
        "area",
        "areas",
        "cultivo",
        "lectura",
        "lecturas",
        "inactividad",
        "dashboard",
        "reporte",
        "reportes",
        "notificacion",
        "notificaciones",
        "whatsapp",
        "umbral",
        "umbrales",
        "frescura",
        "telemetria",
        "cliente",
        "propiedad",
        "historico",
        "historial",
        "recomendacion",
        "riesgo",
    )
    return any(term in text for term in terms)
def _is_math_only_question(text: str) -> bool:
    if not text:
        return False
    return bool(re.fullmatch(r"[\d\s\+\-\*\/\(\)\.,=]+", text))
def _is_domain_follow_up_reference(text: str) -> bool:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return False
    patterns = (
        r"y ayer[?!.]*",
        r"y hoy[?!.]*",
        r"de ayer[?!.]*",
        r"de hoy[?!.]*",
        r"detalla(?: eso)?[?!.]*",
        r"amplia(?: eso)?[?!.]*",
        r"resumen(?: de eso)?[?!.]*",
        r"por area[?!.]*",
        r"por predio[?!.]*",
        r"compara(?: con)?(?: ayer| hoy)?[?!.]*",
        r"prioridades(?: de hoy)?[?!.]*",
        r"que paso ayer[?!.]*",
        r"como estuvo ayer[?!.]*",
    )
    return any(re.fullmatch(pattern, compact) for pattern in patterns)
def _is_in_scope_question(message: str, history: list[dict[str, str]]) -> bool:
    normalized_message = _normalize_text(message)
    if not normalized_message:
        return False

    if _contains_domain_terms(normalized_message):
        return True

    if _is_math_only_question(normalized_message):
        return False

    history_text = " ".join(
        _normalize_text(item.get("content", ""))
        for item in history[-4:]
        if item.get("role") in ("user", "assistant")
    )

    if _contains_domain_terms(history_text) and _is_domain_follow_up_reference(
        normalized_message
    ):
        return True

    return False
def _build_out_of_scope_answer() -> str:
    return (
        "Solo puedo ayudarte con consultas del sistema de riego IoT "
        "(sensores, lecturas, alertas, humedad, flujo, ETO, nodos, areas, "
        "predios y reportes). Reformula tu pregunta en ese contexto."
    )
