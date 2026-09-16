#!/usr/bin/env python3
"""Generate deterministic, offline H0 telemetry and CatWAN serial evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIRECTORY = REPOSITORY_ROOT / "contracts" / "edge-cloud" / "v1"
SUPPORTED_NODE_COUNTS = (1, 8, 16)
RUN_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
RADIO_FRAME_LIMIT_BYTES = 255
EXPECTED_FIELDS = {
    "soil": ("conductivity", "temperature", "humidity", "water_potential"),
    "irrigation": ("active", "accumulated_liters", "flow_per_minute"),
    "environmental": (
        "temperature",
        "relative_humidity",
        "wind_speed",
        "solar_radiation",
        "eto",
    ),
}
RAW_EDGE_PAYLOAD = {
    "s1": {"t": "E5", "v": [720, None, None]},
    "s2": {"t": "T12", "v": [45.6, 22.3, 2500]},
    "s3": {"t": "T21", "v": [-800, 22.3, None]},
}


class HarnessError(ValueError):
    """Raised when H0 input or output invariants are not satisfied."""


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"Cannot load {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise HarnessError(f"Expected a JSON object in {path}")
    return value


def _assert_contract_shape(schema: dict[str, Any], payload: dict[str, Any]) -> None:
    root_fields = {"timestamp", *EXPECTED_FIELDS}
    if schema.get("type") != "object":
        raise HarnessError("Telemetry schema root must remain an object")
    if schema.get("additionalProperties") is not False:
        raise HarnessError("Telemetry schema must reject additional root properties")
    if set(schema.get("required", ())) != root_fields:
        raise HarnessError("Telemetry schema root fields changed from the H0 assumptions")
    if set(schema.get("properties", {})) != root_fields:
        raise HarnessError("Telemetry schema properties changed from the H0 assumptions")
    if set(payload) != root_fields:
        raise HarnessError("Telemetry fixture must contain only timestamp and the three categories")

    for category, expected_names in EXPECTED_FIELDS.items():
        category_schema = schema["properties"].get(category, {})
        expected = set(expected_names)
        if category_schema.get("type") != "object":
            raise HarnessError(f"{category} schema must remain an object")
        if category_schema.get("additionalProperties") is not False:
            raise HarnessError(f"{category} schema must reject additional properties")
        if set(category_schema.get("required", ())) != expected:
            raise HarnessError(f"{category} required fields changed from the H0 assumptions")
        if set(category_schema.get("properties", {})) != expected:
            raise HarnessError(f"{category} properties changed from the H0 assumptions")

        values = payload.get(category)
        if not isinstance(values, dict) or set(values) != expected:
            raise HarnessError(f"Telemetry fixture has an unexpected {category} shape")
        for field, value in values.items():
            expected_types = {"boolean", "null"} if field == "active" else {"number", "null"}
            if set(category_schema["properties"][field].get("type", ())) != expected_types:
                raise HarnessError(f"Schema type changed for {category}.{field}")
            valid = value is None or (isinstance(value, bool) if field == "active" else _is_finite_number(value))
            if not valid:
                raise HarnessError(f"Fixture value has an invalid type for {category}.{field}")

    timestamp = payload.get("timestamp")
    pattern = schema["properties"].get("timestamp", {}).get("pattern")
    if not isinstance(timestamp, str) or not isinstance(pattern, str) or re.fullmatch(pattern, timestamp) is None:
        raise HarnessError("Telemetry timestamp must match the contract's anchored UTC-Z pattern")
    try:
        datetime.fromisoformat(timestamp[:-1] + "+00:00")
    except ValueError as exc:
        raise HarnessError("Telemetry timestamp is not a real calendar date") from exc


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def load_contract_reference(contract_directory: Path = CONTRACT_DIRECTORY) -> dict[str, Any]:
    schema_path = contract_directory / "telemetry.schema.json"
    fixture_path = contract_directory / "fixtures" / "telemetry.valid.json"
    schema = _load_json(schema_path)
    payload = _load_json(fixture_path)
    _assert_contract_shape(schema, payload)
    return {
        "contract": "edge-cloud/v1/telemetry",
        "dynamic_field_count": sum(len(fields) for fields in EXPECTED_FIELDS.values()),
        "dynamic_fields": {category: list(fields) for category, fields in EXPECTED_FIELDS.items()},
        "fixture": "fixtures/telemetry.valid.json",
        "fixture_sha256": hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
        "ndvi_excluded": True,
        "root_fields": ["timestamp", *EXPECTED_FIELDS],
        "schema": "telemetry.schema.json",
    }


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _write_unchanged_or_new(path: Path, content: str) -> None:
    if path.exists():
        if path.read_text(encoding="utf-8") != content:
            raise HarnessError(f"Refusing to overwrite different evidence: {path}")
        return
    path.write_text(content, encoding="utf-8")


def generate_batch(
    node_count: int,
    run_id: str,
    output_directory: Path,
    contract_directory: Path = CONTRACT_DIRECTORY,
) -> dict[str, Any]:
    if node_count not in SUPPORTED_NODE_COUNTS:
        raise HarnessError(f"Node count must be one of {SUPPORTED_NODE_COUNTS}")
    if RUN_ID_PATTERN.fullmatch(run_id) is None:
        raise HarnessError("Run ID must be 1-64 characters using letters, numbers, dot, underscore, or hyphen")

    contract_reference = load_contract_reference(contract_directory)
    raw_payload_text = _canonical_json(RAW_EDGE_PAYLOAD)
    events: list[dict[str, Any]] = []
    serial_lines: list[str] = []
    maximum_frame_bytes = 0

    for index in range(1, node_count + 1):
        node_code = f"H{index:04X}"
        logical_capture_key = f"{run_id}/{node_code}/reading-0001"
        digest = hashlib.sha256(logical_capture_key.encode("ascii")).digest()
        mesh_message_id = int.from_bytes(digest[:4], "big") or 1
        mesh_frame = f"M1|{node_code}|*|{mesh_message_id}|4|DATA|{raw_payload_text}"
        frame_bytes = len(mesh_frame.encode("utf-8"))
        if frame_bytes >= RADIO_FRAME_LIMIT_BYTES:
            raise HarnessError(f"Generated radio frame is {frame_bytes} bytes; firmware requires fewer than 255")
        maximum_frame_bytes = max(maximum_frame_bytes, frame_bytes)
        events.append(
            {
                "logical_capture_key": logical_capture_key,
                "mesh_message_id": mesh_message_id,
                "node_code": node_code,
                "radio_frame_bytes": frame_bytes,
                "raw_edge_payload": deepcopy(RAW_EDGE_PAYLOAD),
            }
        )
        serial_lines.extend((f"RXFRAME|-70|7.5|{mesh_frame}", raw_payload_text))

    expected_counts = {
        "bare_json_lines": node_count,
        "distinct_nodes": node_count,
        "logical_events": node_count,
        "rxframe_lines": node_count,
        "serial_lines": node_count * 2,
    }
    batch = {
        "boundary_facts": {
            "central_duplicates_json_data_as_bare_line": True,
            "firmware_frame_rule": "UTF-8 radio frame bytes < 255",
            "firmware_packet_limit_bytes": RADIO_FRAME_LIMIT_BYTES,
            "maximum_generated_radio_frame_bytes": maximum_frame_bytes,
            "node_id_shape": "H%04X",
            "parser_grammar": "RXFRAME|rssi|snr|M1|src|dst|id|ttl|type|payload",
            "raw_payload_shape": "s1/s2/s3 objects with t and three-value v",
            "revalidate_before_h1": True,
            "telemetry_destination": "*",
        },
        "contract_reference": contract_reference,
        "events": events,
        "expected_counts": expected_counts,
        "harness": "h0/v1",
        "run_id": run_id,
    }

    output_directory.mkdir(parents=True, exist_ok=True)
    batch_text = json.dumps(batch, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    serial_text = "\n".join(serial_lines) + "\n"
    _write_unchanged_or_new(output_directory / "batch.json", batch_text)
    _write_unchanged_or_new(output_directory / "serial-input.txt", serial_text)
    return batch


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nodes", type=int, choices=SUPPORTED_NODE_COUNTS, required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        batch = generate_batch(args.nodes, args.run_id, args.output_dir)
    except HarnessError as exc:
        print(f"H0 error: {exc}", file=sys.stderr)
        return 2
    print(_canonical_json({"expected_counts": batch["expected_counts"], "run_id": batch["run_id"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
