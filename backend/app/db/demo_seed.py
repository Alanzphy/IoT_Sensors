from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.models.threshold import Threshold
from app.models.user import User

PRIORITY_PARAMETERS = (
    "soil.humidity",
    "irrigation.flow_per_minute",
    "environmental.eto",
)
SEVERITIES = ("info", "warning", "critical")
DEFAULT_DAYS = 30
DEFAULT_SEED = 20260423
DEFAULT_BATCH_SIZE = 1000
EXPECTED_READINGS_PER_DAY = 144
READING_STEP_MINUTES = 10


@dataclass(frozen=True)
class ScopedArea:
    property_id: int
    property_name: str
    area_id: int
    area_name: str
    node_id: int | None
    node_name: str | None
    node_active: bool | None
    api_key: str | None


@dataclass
class NodeGenerationState:
    rng: random.Random
    soil_humidity: float
    accumulated_liters: float
    flow_base: float
    temp_offset: float


def utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def floor_to_10min(dt: datetime) -> datetime:
    return dt.replace(minute=(dt.minute // 10) * 10, second=0, microsecond=0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Demo seed orchestration for scoped IoT dataset generation."
    )
    parser.add_argument("--client-email", required=True, help="Target client email")
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help=f"Historical window in rolling days (default: {DEFAULT_DAYS})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"Deterministic random seed (default: {DEFAULT_SEED})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and report actions without mutating database state",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Insert batch size for readings (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--snapshot-dir",
        default="demo_seed_snapshots",
        help="Directory where snapshot JSON files are written",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)
    snapshot_parser = subparsers.add_parser("snapshot", help="Generate scope snapshot")
    snapshot_parser.add_argument(
        "--label",
        default="manual",
        help="Snapshot label suffix (default: manual)",
    )
    subparsers.add_parser(
        "purge",
        help="Purge dynamic data scoped to active-node areas of target client",
    )
    subparsers.add_parser(
        "seed-readings",
        help="Generate deterministic historical readings for active nodes",
    )
    subparsers.add_parser(
        "seed-thresholds",
        help="Seed priority thresholds with deterministic mixed severities",
    )
    subparsers.add_parser(
        "run-all",
        help="Execute snapshot -> purge -> seed-readings -> seed-thresholds -> snapshot",
    )
    return parser.parse_args()


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _solar_factor(hour: float) -> float:
    if hour < 6 or hour > 20:
        return 0.0
    return max(0.0, math.sin(math.pi * (hour - 6) / 14))


def _irrigation_window(hour: float, state: NodeGenerationState) -> bool:
    morning = 5.0 <= hour < 7.0
    evening = 17.0 <= hour < 19.0
    emergency = state.soil_humidity < 22.0 and (11.0 <= hour < 12.0)
    return morning or evening or emergency


def _maybe_missing(
    rng: random.Random,
    value: float | None,
    *,
    null_rate: float,
    zero_rate: float,
) -> float | None:
    if value is None:
        return None
    roll = rng.random()
    if roll < null_rate:
        return None
    if roll < (null_rate + zero_rate):
        return 0.0
    return value


def _init_node_state(node_id: int, seed: int) -> NodeGenerationState:
    rng = random.Random(seed + (node_id * 1009))
    return NodeGenerationState(
        rng=rng,
        soil_humidity=rng.uniform(31.0, 44.0),
        accumulated_liters=rng.uniform(50.0, 220.0),
        flow_base=rng.uniform(7.2, 9.1),
        temp_offset=rng.uniform(-1.4, 1.4),
    )


def _generate_reading_row(
    ts: datetime,
    node_id: int,
    state: NodeGenerationState,
) -> dict[str, Any]:
    rng = state.rng
    hour = ts.hour + (ts.minute / 60)
    solar = _solar_factor(hour)
    noise = rng.gauss(0.0, 1.0)

    env_temp = clamp(
        11.0 + (22.0 * _solar_factor(min(hour + 2, 24))) + (noise * 1.4) + state.temp_offset,
        6.0,
        44.0,
    )
    env_rh = clamp(85.0 - (42.0 * solar) + (noise * 2.8), 18.0, 98.0)
    env_wind = clamp(4.0 + (11.0 * solar) + abs(noise * 2.6), 0.0, 42.0)
    env_solar_rad = 0.0
    if solar > 0:
        env_solar_rad = clamp((940.0 * solar) + (noise * 25.0), 0.0, 1100.0)

    eto_raw = (
        (0.0027 * env_solar_rad) + (0.095 * env_temp) + (0.045 * env_wind)
    ) * (0.35 + (0.65 * solar))
    env_eto = clamp(eto_raw + (noise * 0.25), 0.0, 11.5)

    soil_temp = clamp(
        14.0 + (11.0 * _solar_factor(min(hour + 4, 24))) + (noise * 0.45),
        7.0,
        39.0,
    )
    soil_cond = clamp(2.4 + (noise * 0.25), 0.5, 5.0)

    irrigating = _irrigation_window(hour, state)
    evap_loss = 0.08 + (0.17 * solar) + max(env_temp - 31.0, 0.0) * 0.02
    irrig_gain = (1.4 + rng.uniform(0.2, 1.2)) if irrigating else 0.0
    state.soil_humidity += irrig_gain - evap_loss + (noise * 0.08)
    state.soil_humidity = clamp(state.soil_humidity, 9.0, 67.0)

    flow = 0.0
    if irrigating:
        flow = clamp(state.flow_base + rng.uniform(-1.6, 1.6) + (noise * 0.35), 2.8, 14.5)

    state.accumulated_liters += flow * (READING_STEP_MINUTES / 60.0)
    soil_wp = clamp((-0.03 * (60.0 - state.soil_humidity)) + (noise * 0.04), -3.0, -0.1)

    humidity = _maybe_missing(
        rng,
        round(state.soil_humidity, 2),
        null_rate=0.0008,
        zero_rate=0.0008,
    )
    flow_value = _maybe_missing(
        rng,
        round(flow, 2),
        null_rate=0.0006,
        zero_rate=0.001,
    )
    eto_value = _maybe_missing(
        rng,
        round(env_eto, 3),
        null_rate=0.0012,
        zero_rate=0.0006,
    )

    return {
        "nodo_id": node_id,
        "marca_tiempo": ts,
        "suelo_conductividad": _maybe_missing(
            rng,
            round(soil_cond, 3),
            null_rate=0.003,
            zero_rate=0.001,
        ),
        "suelo_temperatura": _maybe_missing(
            rng,
            round(soil_temp, 2),
            null_rate=0.0025,
            zero_rate=0.001,
        ),
        "suelo_humedad": humidity,
        "suelo_potencial_hidrico": _maybe_missing(
            rng,
            round(soil_wp, 4),
            null_rate=0.003,
            zero_rate=0.0,
        ),
        "riego_activo": irrigating,
        "riego_litros_acumulados": round(state.accumulated_liters, 2),
        "riego_flujo_por_minuto": flow_value,
        "ambiental_temperatura": _maybe_missing(
            rng,
            round(env_temp, 2),
            null_rate=0.0025,
            zero_rate=0.001,
        ),
        "ambiental_humedad_relativa": _maybe_missing(
            rng,
            round(env_rh, 2),
            null_rate=0.002,
            zero_rate=0.001,
        ),
        "ambiental_velocidad_viento": _maybe_missing(
            rng,
            round(env_wind, 2),
            null_rate=0.003,
            zero_rate=0.001,
        ),
        "ambiental_radiacion_solar": _maybe_missing(
            rng,
            round(env_solar_rad, 2),
            null_rate=0.003,
            zero_rate=0.0012,
        ),
        "ambiental_eto": eto_value,
    }


def resolve_scope(db: Session, client_email: str) -> dict[str, Any]:
    user = db.execute(
        select(User).where(
            User.correo == client_email,
            User.eliminado_en.is_(None),
            User.activo.is_(True),
        )
    ).scalar_one_or_none()
    if user is None:
        raise ValueError(f"User '{client_email}' not found or inactive")

    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id,
            Client.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if client is None:
        raise ValueError(f"Client record not found for user '{client_email}'")

    rows = db.execute(
        select(
            Property.id,
            Property.nombre,
            IrrigationArea.id,
            IrrigationArea.nombre,
            Node.id,
            Node.nombre,
            Node.activo,
            Node.api_key,
        )
        .select_from(Property)
        .join(
            IrrigationArea,
            (IrrigationArea.predio_id == Property.id)
            & (IrrigationArea.eliminado_en.is_(None)),
        )
        .outerjoin(
            Node,
            (Node.area_riego_id == IrrigationArea.id) & (Node.eliminado_en.is_(None)),
        )
        .where(
            Property.cliente_id == client.id,
            Property.eliminado_en.is_(None),
        )
        .order_by(Property.id, IrrigationArea.id)
    ).all()

    if not rows:
        raise ValueError(f"Client '{client_email}' has no irrigation areas")

    scoped_areas: list[ScopedArea] = [
        ScopedArea(
            property_id=row[0],
            property_name=row[1],
            area_id=row[2],
            area_name=row[3],
            node_id=row[4],
            node_name=row[5],
            node_active=row[6],
            api_key=row[7],
        )
        for row in rows
    ]

    included: list[ScopedArea] = []
    excluded: list[dict[str, Any]] = []

    for area in scoped_areas:
        if area.node_id is None:
            excluded.append(
                {
                    "property_id": area.property_id,
                    "property_name": area.property_name,
                    "area_id": area.area_id,
                    "area_name": area.area_name,
                    "reason": "missing_node",
                }
            )
            continue

        if area.node_active is not True:
            excluded.append(
                {
                    "property_id": area.property_id,
                    "property_name": area.property_name,
                    "area_id": area.area_id,
                    "area_name": area.area_name,
                    "node_id": area.node_id,
                    "node_name": area.node_name,
                    "reason": "inactive_node",
                }
            )
            continue

        included.append(area)

    included_area_ids = sorted({item.area_id for item in included})
    included_node_ids = sorted({item.node_id for item in included if item.node_id is not None})

    return {
        "client_email": client_email,
        "user_id": user.id,
        "client_id": client.id,
        "all_areas": scoped_areas,
        "included_areas": included,
        "excluded_areas": excluded,
        "included_area_ids": included_area_ids,
        "included_node_ids": included_node_ids,
    }


def _per_node_reading_stats(db: Session, node_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not node_ids:
        return {}

    rows = db.execute(
        select(
            Reading.nodo_id,
            func.count(),
            func.min(Reading.marca_tiempo),
            func.max(Reading.marca_tiempo),
        )
        .where(Reading.nodo_id.in_(node_ids))
        .group_by(Reading.nodo_id)
    ).all()
    return {
        row[0]: {
            "count": int(row[1]),
            "min_timestamp": row[2].isoformat() if row[2] is not None else None,
            "max_timestamp": row[3].isoformat() if row[3] is not None else None,
        }
        for row in rows
    }


def _per_area_count(
    db: Session,
    area_ids: list[int],
    model: Any,
    area_field: Any,
    *,
    only_active_thresholds: bool = False,
) -> dict[int, int]:
    if not area_ids:
        return {}

    query = (
        select(area_field, func.count())
        .where(area_field.in_(area_ids))
        .group_by(area_field)
    )
    if model is Threshold and only_active_thresholds:
        query = query.where(Threshold.eliminado_en.is_(None))
    rows = db.execute(query).all()
    return {row[0]: int(row[1]) for row in rows}


def build_snapshot_payload(
    db: Session,
    scope: dict[str, Any],
    *,
    days: int,
    seed: int,
    command: str,
    dry_run: bool,
) -> dict[str, Any]:
    included = scope["included_areas"]
    excluded = scope["excluded_areas"]
    included_area_ids = scope["included_area_ids"]
    included_node_ids = scope["included_node_ids"]
    all_area_ids = sorted({item.area_id for item in scope["all_areas"]})

    readings_stats = _per_node_reading_stats(db, included_node_ids)
    alerts_per_area = _per_area_count(db, included_area_ids, Alert, Alert.area_riego_id)
    active_thresholds_per_area = _per_area_count(
        db,
        included_area_ids,
        Threshold,
        Threshold.area_riego_id,
        only_active_thresholds=True,
    )
    soft_deleted_thresholds_per_area = _per_area_count(
        db,
        included_area_ids,
        Threshold,
        Threshold.area_riego_id,
        only_active_thresholds=False,
    )

    readings_total = sum(item["count"] for item in readings_stats.values())
    alerts_total = sum(alerts_per_area.values())
    active_thresholds_total = sum(active_thresholds_per_area.values())
    all_threshold_rows = sum(soft_deleted_thresholds_per_area.values())
    soft_deleted_thresholds_total = all_threshold_rows - active_thresholds_total

    areas_payload: list[dict[str, Any]] = []
    for item in included:
        node_stats = readings_stats.get(item.node_id or -1, {})
        areas_payload.append(
            {
                "property_id": item.property_id,
                "property_name": item.property_name,
                "area_id": item.area_id,
                "area_name": item.area_name,
                "node_id": item.node_id,
                "node_name": item.node_name,
                "node_active": item.node_active,
                "api_key": item.api_key,
                "readings_count": node_stats.get("count", 0),
                "readings_min_timestamp": node_stats.get("min_timestamp"),
                "readings_max_timestamp": node_stats.get("max_timestamp"),
                "alerts_count": alerts_per_area.get(item.area_id, 0),
                "active_thresholds_count": active_thresholds_per_area.get(item.area_id, 0),
            }
        )

    return {
        "generated_at_utc": utc_now_naive().isoformat(),
        "command": command,
        "dry_run": dry_run,
        "parameters": {
            "client_email": scope["client_email"],
            "days": days,
            "seed": seed,
            "expected_readings_per_node": days * EXPECTED_READINGS_PER_DAY,
            "reading_interval_minutes": READING_STEP_MINUTES,
        },
        "scope": {
            "user_id": scope["user_id"],
            "client_id": scope["client_id"],
            "all_area_ids": all_area_ids,
            "included_area_ids": included_area_ids,
            "included_node_ids": included_node_ids,
            "included_areas": areas_payload,
            "excluded_areas": excluded,
        },
        "totals": {
            "included_areas": len(included_area_ids),
            "excluded_areas": len(excluded),
            "included_nodes": len(included_node_ids),
            "readings_total": readings_total,
            "alerts_total": alerts_total,
            "active_thresholds_total": active_thresholds_total,
            "soft_deleted_thresholds_total": soft_deleted_thresholds_total,
        },
    }


def write_snapshot(snapshot_dir: str, snapshot: dict[str, Any], label: str) -> Path:
    out_dir = Path(snapshot_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = utc_now_naive().strftime("%Y%m%dT%H%M%SZ")
    safe_email = snapshot["parameters"]["client_email"].replace("@", "_at_")
    filename = f"snapshot_{safe_email}_{label}_{timestamp}.json"
    out_path = out_dir / filename
    out_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8")
    return out_path


def cmd_snapshot(db: Session, args: argparse.Namespace, *, label: str | None = None) -> dict[str, Any]:
    scope = resolve_scope(db, args.client_email)
    snapshot = build_snapshot_payload(
        db,
        scope,
        days=args.days,
        seed=args.seed,
        command="snapshot",
        dry_run=args.dry_run,
    )
    file_label = label if label is not None else args.label
    path = write_snapshot(args.snapshot_dir, snapshot, file_label)
    return {"snapshot_path": str(path), "snapshot": snapshot}


def cmd_purge(db: Session, args: argparse.Namespace) -> dict[str, Any]:
    scope = resolve_scope(db, args.client_email)
    area_ids = scope["included_area_ids"]
    node_ids = scope["included_node_ids"]

    if not area_ids or not node_ids:
        return {
            "dry_run": args.dry_run,
            "message": "No eligible areas/nodes to purge (all areas excluded)",
            "included_area_ids": area_ids,
            "included_node_ids": node_ids,
        }

    pre_snapshot = build_snapshot_payload(
        db,
        scope,
        days=args.days,
        seed=args.seed,
        command="purge-precheck",
        dry_run=args.dry_run,
    )

    if args.dry_run:
        return {
            "dry_run": True,
            "scope": {
                "included_area_ids": area_ids,
                "included_node_ids": node_ids,
                "excluded_areas": scope["excluded_areas"],
            },
            "would_delete": {
                "readings": pre_snapshot["totals"]["readings_total"],
                "alerts": pre_snapshot["totals"]["alerts_total"],
                "active_thresholds_soft_delete": pre_snapshot["totals"]["active_thresholds_total"],
            },
        }

    now_utc = utc_now_naive()
    deleted_alerts = db.execute(
        delete(Alert).where(
            (Alert.area_riego_id.in_(area_ids)) | (Alert.nodo_id.in_(node_ids))
        )
    ).rowcount or 0
    deleted_readings = db.execute(
        delete(Reading).where(Reading.nodo_id.in_(node_ids))
    ).rowcount or 0
    soft_deleted_thresholds = db.execute(
        update(Threshold)
        .where(
            Threshold.area_riego_id.in_(area_ids),
            Threshold.eliminado_en.is_(None),
        )
        .values(
            activo=False,
            eliminado_en=now_utc,
            actualizado_en=now_utc,
        )
    ).rowcount or 0
    db.commit()

    post_snapshot = build_snapshot_payload(
        db,
        scope,
        days=args.days,
        seed=args.seed,
        command="purge-postcheck",
        dry_run=False,
    )
    return {
        "dry_run": False,
        "scope": {
            "included_area_ids": area_ids,
            "included_node_ids": node_ids,
            "excluded_areas": scope["excluded_areas"],
        },
        "deleted": {
            "alerts": int(deleted_alerts),
            "readings": int(deleted_readings),
            "soft_deleted_thresholds": int(soft_deleted_thresholds),
        },
        "post_validation": {
            "readings_total": post_snapshot["totals"]["readings_total"],
            "alerts_total": post_snapshot["totals"]["alerts_total"],
            "active_thresholds_total": post_snapshot["totals"]["active_thresholds_total"],
        },
    }


def _time_window(days: int) -> tuple[datetime, datetime]:
    end_slot = floor_to_10min(utc_now_naive())
    start_slot = end_slot - timedelta(days=days)
    return start_slot, end_slot


def cmd_seed_readings(db: Session, args: argparse.Namespace) -> dict[str, Any]:
    scope = resolve_scope(db, args.client_email)
    included = scope["included_areas"]

    if not included:
        return {
            "dry_run": args.dry_run,
            "message": "No eligible areas/nodes to seed",
            "excluded_areas": scope["excluded_areas"],
        }

    start_slot, end_slot = _time_window(args.days)
    expected_per_node = args.days * EXPECTED_READINGS_PER_DAY
    delta = timedelta(minutes=READING_STEP_MINUTES)

    reports: list[dict[str, Any]] = []
    total_inserted = 0

    for item in included:
        if item.node_id is None:
            continue

        state = _init_node_state(item.node_id, args.seed)
        batch: list[dict[str, Any]] = []
        inserted_for_node = 0
        ts = start_slot
        first_ts = None
        last_ts = None

        for _ in range(expected_per_node):
            row = _generate_reading_row(ts, item.node_id, state)
            first_ts = ts if first_ts is None else first_ts
            last_ts = ts
            batch.append(row)
            ts += delta

            if len(batch) >= args.batch_size:
                if not args.dry_run:
                    db.execute(insert(Reading), batch)
                    db.commit()
                inserted_for_node += len(batch)
                batch = []

        if batch:
            if not args.dry_run:
                db.execute(insert(Reading), batch)
                db.commit()
            inserted_for_node += len(batch)

        total_inserted += inserted_for_node
        reports.append(
            {
                "property_id": item.property_id,
                "property_name": item.property_name,
                "area_id": item.area_id,
                "area_name": item.area_name,
                "node_id": item.node_id,
                "node_name": item.node_name,
                "inserted": inserted_for_node,
                "expected": expected_per_node,
                "range_start_utc": first_ts.isoformat() if first_ts is not None else None,
                "range_end_utc": last_ts.isoformat() if last_ts is not None else None,
            }
        )

    if not args.dry_run:
        db.commit()

    return {
        "dry_run": args.dry_run,
        "window": {
            "days": args.days,
            "start_utc": start_slot.isoformat(),
            "end_utc_exclusive": end_slot.isoformat(),
            "expected_per_node": expected_per_node,
            "reading_interval_minutes": READING_STEP_MINUTES,
        },
        "seed": args.seed,
        "inserted_total": total_inserted,
        "excluded_areas": scope["excluded_areas"],
        "nodes": reports,
    }


def _threshold_config(parameter: str, severity: str) -> tuple[float | None, float | None]:
    table: dict[str, dict[str, tuple[float | None, float | None]]] = {
        "soil.humidity": {
            "info": (20.0, 46.0),
            "warning": (24.0, 42.0),
            "critical": (28.0, 38.0),
        },
        "irrigation.flow_per_minute": {
            "info": (0.0, 11.5),
            "warning": (0.0, 10.5),
            "critical": (0.0, 9.5),
        },
        "environmental.eto": {
            "info": (0.0, 6.8),
            "warning": (0.0, 5.8),
            "critical": (0.0, 5.0),
        },
    }
    return table[parameter][severity]


def cmd_seed_thresholds(db: Session, args: argparse.Namespace) -> dict[str, Any]:
    scope = resolve_scope(db, args.client_email)
    included = sorted(scope["included_areas"], key=lambda item: item.area_id)
    area_ids = [item.area_id for item in included]
    if not area_ids:
        return {
            "dry_run": args.dry_run,
            "message": "No eligible areas/nodes to seed thresholds",
            "excluded_areas": scope["excluded_areas"],
        }

    now_utc = utc_now_naive()
    if not args.dry_run:
        db.execute(
            update(Threshold)
            .where(
                Threshold.area_riego_id.in_(area_ids),
                Threshold.eliminado_en.is_(None),
                Threshold.parametro.in_(list(PRIORITY_PARAMETERS)),
            )
            .values(activo=False, eliminado_en=now_utc, actualizado_en=now_utc)
        )
        db.commit()

    rows_to_insert: list[dict[str, Any]] = []
    preview: list[dict[str, Any]] = []
    for area_index, area in enumerate(included):
        for parameter_index, parameter in enumerate(PRIORITY_PARAMETERS):
            severity = SEVERITIES[(area_index + parameter_index) % len(SEVERITIES)]
            min_value, max_value = _threshold_config(parameter, severity)
            payload = {
                "area_riego_id": area.area_id,
                "parametro": parameter,
                "rango_min": min_value,
                "rango_max": max_value,
                "severidad": severity,
                "activo": True,
                "creado_en": now_utc,
                "actualizado_en": now_utc,
                "eliminado_en": None,
            }
            rows_to_insert.append(payload)
            preview.append(
                {
                    "area_id": area.area_id,
                    "area_name": area.area_name,
                    "parameter": parameter,
                    "severity": severity,
                    "min_value": min_value,
                    "max_value": max_value,
                }
            )

    if not args.dry_run:
        db.execute(insert(Threshold), rows_to_insert)
        db.commit()

    return {
        "dry_run": args.dry_run,
        "inserted_thresholds": len(rows_to_insert),
        "areas_count": len(included),
        "excluded_areas": scope["excluded_areas"],
        "thresholds": preview,
    }


def cmd_run_all(db: Session, args: argparse.Namespace) -> dict[str, Any]:
    pre = cmd_snapshot(db, args, label="pre")
    purge = cmd_purge(db, args)
    seed_readings = cmd_seed_readings(db, args)
    seed_thresholds = cmd_seed_thresholds(db, args)
    post = cmd_snapshot(db, args, label="post")
    return {
        "dry_run": args.dry_run,
        "sequence": "snapshot(pre) -> purge -> seed-readings -> seed-thresholds -> snapshot(post)",
        "results": {
            "snapshot_pre": pre,
            "purge": purge,
            "seed_readings": seed_readings,
            "seed_thresholds": seed_thresholds,
            "snapshot_post": post,
        },
    }


def main() -> None:
    args = parse_args()
    with SessionLocal() as db:
        try:
            if args.command == "snapshot":
                result = cmd_snapshot(db, args)
            elif args.command == "purge":
                result = cmd_purge(db, args)
            elif args.command == "seed-readings":
                result = cmd_seed_readings(db, args)
            elif args.command == "seed-thresholds":
                result = cmd_seed_thresholds(db, args)
            elif args.command == "run-all":
                result = cmd_run_all(db, args)
            else:
                raise ValueError(f"Unsupported command '{args.command}'")
        except Exception:
            db.rollback()
            raise

    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
