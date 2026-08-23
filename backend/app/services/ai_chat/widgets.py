from typing import Any

from app.services.ai_chat.helpers import _round


def _build_dynamic_widgets(
    *,
    question: str,
    context: dict[str, Any],
) -> list[dict[str, Any]]:
    _ = question
    widgets: list[dict[str, Any]] = []
    summary = context.get("summary", {})
    alerts = summary.get("alerts", {}) or {}
    areas: list[dict[str, Any]] = context.get("areas", []) or []
    hours_back = context.get("window", {}).get("hours_back", 72)

    # KPI cards
    widgets.append(
        {
            "type": "kpi_cards",
            "title": f"Resumen operativo ({hours_back}h)",
            "items": [
                {
                    "key": "areas_count",
                    "label": "Areas en alcance",
                    "value": summary.get("areas_count", 0),
                },
                {
                    "key": "stale_areas_20m",
                    "label": "Areas sin datos >=20 min",
                    "value": summary.get("stale_areas_20m", 0),
                },
                {
                    "key": "critical_alerts",
                    "label": "Alertas criticas",
                    "value": alerts.get("critical", 0),
                },
                {
                    "key": "unread_alerts",
                    "label": "Alertas no leidas",
                    "value": alerts.get("unread", 0),
                },
            ],
        }
    )

    # Ranking table by risk (staleness + low humidity)
    table_rows: list[dict[str, Any]] = []
    for area in areas:
        latest = area.get("latest", {}) or {}
        window_stats = area.get("window_stats", {}) or {}
        freshness = area.get("freshness_minutes")
        humidity = latest.get("soil_humidity")
        row = {
            "area": area.get("area_name"),
            "predio": area.get("property_name"),
            "humedad": humidity,
            "flujo": latest.get("flow_per_minute"),
            "eto": latest.get("eto"),
            "frescura_min": freshness,
            "lecturas": window_stats.get("readings_count", 0),
        }
        table_rows.append(row)

    def _risk_key(item: dict[str, Any]) -> tuple[int, float, float]:
        freshness = item.get("frescura_min")
        humidity = item.get("humedad")
        freshness_score = freshness if isinstance(freshness, (int, float)) else -1
        humidity_score = humidity if isinstance(humidity, (int, float)) else 9999.0
        no_data_penalty = 1 if humidity is None else 0
        return (int(freshness_score), -float(humidity_score), -no_data_penalty)

    ranked_rows = sorted(table_rows, key=_risk_key, reverse=True)[:10]
    if ranked_rows:
        widgets.append(
            {
                "type": "table",
                "title": "Areas priorizadas para revision",
                "columns": [
                    {"key": "area", "label": "Area"},
                    {"key": "predio", "label": "Predio"},
                    {"key": "humedad", "label": "Humedad (%)"},
                    {"key": "flujo", "label": "Flujo (L/min)"},
                    {"key": "eto", "label": "ETO"},
                    {"key": "frescura_min", "label": "Sin dato (min)"},
                    {"key": "lecturas", "label": "Lecturas"},
                ],
                "rows": ranked_rows,
            }
        )

    # Daily trend chart aggregated across areas
    daily_buckets: dict[str, dict[str, float]] = {}
    for area in areas:
        for stat in area.get("daily_stats", []) or []:
            day = stat.get("date")
            if not day:
                continue
            readings_count = stat.get("readings_count")
            weight = float(readings_count) if isinstance(readings_count, (int, float)) else 0.0
            if weight <= 0:
                continue

            bucket = daily_buckets.setdefault(
                day,
                {
                    "weight": 0.0,
                    "hum_sum": 0.0,
                    "flow_sum": 0.0,
                    "eto_sum": 0.0,
                    "hum_weight": 0.0,
                    "flow_weight": 0.0,
                    "eto_weight": 0.0,
                },
            )
            bucket["weight"] += weight

            hum = stat.get("soil_humidity_avg")
            if isinstance(hum, (int, float)):
                bucket["hum_sum"] += float(hum) * weight
                bucket["hum_weight"] += weight
            flow = stat.get("flow_avg")
            if isinstance(flow, (int, float)):
                bucket["flow_sum"] += float(flow) * weight
                bucket["flow_weight"] += weight
            eto = stat.get("eto_avg")
            if isinstance(eto, (int, float)):
                bucket["eto_sum"] += float(eto) * weight
                bucket["eto_weight"] += weight

    chart_data: list[dict[str, Any]] = []
    for day in sorted(daily_buckets.keys())[-7:]:
        bucket = daily_buckets[day]
        chart_data.append(
            {
                "date": day,
                "soil_humidity_avg": _round(
                    (bucket["hum_sum"] / bucket["hum_weight"]) if bucket["hum_weight"] > 0 else None,
                    digits=2,
                ),
                "flow_avg": _round(
                    (bucket["flow_sum"] / bucket["flow_weight"]) if bucket["flow_weight"] > 0 else None,
                    digits=2,
                ),
                "eto_avg": _round(
                    (bucket["eto_sum"] / bucket["eto_weight"]) if bucket["eto_weight"] > 0 else None,
                    digits=3,
                ),
            }
        )

    if len(chart_data) >= 2:
        widgets.append(
            {
                "type": "line_chart",
                "title": "Tendencia diaria (promedio ponderado por lecturas)",
                "x_key": "date",
                "series": [
                    {
                        "key": "soil_humidity_avg",
                        "label": "Humedad (%)",
                        "color": "var(--chart-4)",
                    },
                    {
                        "key": "flow_avg",
                        "label": "Flujo (L/min)",
                        "color": "var(--chart-1)",
                    },
                    {
                        "key": "eto_avg",
                        "label": "ETO",
                        "color": "var(--chart-3)",
                    },
                ],
                "data": chart_data,
            }
        )

    return widgets
