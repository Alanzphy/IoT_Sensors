#!/usr/bin/env python3
"""
Upsert de umbrales para la demo del socio (Granja Hogar / Campus Reforestado).

Objetivo:
- Ajustar umbrales para que el modo `demo-alerts` de `simulator_fast.py`
  dispare alertas visibles de forma consistente.
- Aplicar cambios via API (admin) para que se reflejen de inmediato en el sistema.
"""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "https://sensores.alanrz.bond/api/v1"
DEFAULT_ADMIN_EMAIL = "admin@sensores.com"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_CLIENT_EMAIL = "alan2203mx@gmail.com"
DEFAULT_AREA_NAMES = ["Area Granja Hogar", "Area Campus Reforestado"]

DEFAULT_HTTP_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
    "SensoresIoT-ThresholdUpsert/1.0"
)

PRIORITY_PARAMETERS = (
    "soil.humidity",
    "irrigation.flow_per_minute",
    "environmental.eto",
)


@dataclass(frozen=True)
class ThresholdRule:
    parameter: str
    min_value: float | None
    max_value: float | None
    severity: str


PROFILES: dict[str, tuple[ThresholdRule, ...]] = {
    # Perfil alineado al comportamiento de simulator_fast --mode demo-alerts.
    "demo-alerts": (
        ThresholdRule(
            parameter="soil.humidity",
            min_value=24.0,
            max_value=42.0,
            severity="warning",
        ),
        ThresholdRule(
            parameter="irrigation.flow_per_minute",
            min_value=0.0,
            max_value=10.5,
            severity="warning",
        ),
        ThresholdRule(
            parameter="environmental.eto",
            min_value=0.0,
            max_value=5.8,
            severity="critical",
        ),
    ),
}


class ApiClient:
    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        user_agent: str = DEFAULT_HTTP_USER_AGENT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.user_agent = user_agent

    def with_token(self, token: str) -> "ApiClient":
        return ApiClient(self.base_url, token, self.user_agent)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> tuple[int, dict[str, Any]]:
        query = ""
        if params:
            query = "?" + urllib.parse.urlencode(params)
        url = f"{self.base_url}{path}{query}"
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url=url, data=data, method=method.upper())
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json, text/plain, */*")
        req.add_header("User-Agent", self.user_agent)
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                parsed = json.loads(body) if body else {}
                return resp.status, parsed
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body) if body else {}
            except json.JSONDecodeError:
                parsed = {"detail": body[:300]}
            return exc.code, parsed
        except urllib.error.URLError as exc:
            return 0, {"detail": f"No se pudo conectar: {exc.reason}"}
        except TimeoutError:
            return 0, {"detail": "Timeout al conectar"}

    def get(self, path: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
        status, payload = self._request("GET", path, params=params)
        if status != 200:
            raise RuntimeError(f"GET {path} fallo (HTTP {status}): {payload}")
        return payload

    def post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        status, parsed = self._request("POST", path, payload=payload)
        if status not in (200, 201):
            raise RuntimeError(f"POST {path} fallo (HTTP {status}): {parsed}")
        return parsed

    def put(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        status, parsed = self._request("PUT", path, payload=payload)
        if status != 200:
            raise RuntimeError(f"PUT {path} fallo (HTTP {status}): {parsed}")
        return parsed

    def list_all(self, path: str, *, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        page = 1
        out: list[dict[str, Any]] = []
        base = dict(params or {})
        while True:
            payload = self.get(path, params={**base, "page": page, "per_page": 200})
            batch = payload.get("data") or []
            if not isinstance(batch, list):
                raise RuntimeError(f"Respuesta inesperada en {path}: {payload}")
            out.extend(batch)
            total = int(payload.get("total") or 0)
            if len(out) >= total or not batch:
                break
            page += 1
        return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upsert de umbrales productivos para Granja/Campus"
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--admin-email", default=DEFAULT_ADMIN_EMAIL)
    parser.add_argument("--admin-password", default=DEFAULT_ADMIN_PASSWORD)
    parser.add_argument("--client-email", default=DEFAULT_CLIENT_EMAIL)
    parser.add_argument(
        "--area-name",
        action="append",
        dest="area_names",
        default=[],
        help="Nombre de area objetivo (puede repetirse).",
    )
    parser.add_argument(
        "--profile",
        choices=tuple(PROFILES.keys()),
        default="demo-alerts",
        help="Perfil de umbrales a aplicar.",
    )
    return parser.parse_args()


def _login(base_url: str, email: str, password: str) -> str:
    public_client = ApiClient(base_url)
    payload = public_client.post("/auth/login", {"email": email, "password": password})
    token = payload.get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError(f"Login sin access_token: {payload}")
    return token


def _resolve_client_id(client: ApiClient, email: str) -> int:
    clients = client.list_all("/clients")
    for row in clients:
        user = row.get("user") or {}
        if isinstance(user, dict) and user.get("email") == email:
            return int(row["id"])
    raise RuntimeError(f"No se encontro client_id para '{email}'")


def _resolve_target_areas(client: ApiClient, *, client_id: int, area_names: list[str]) -> list[dict[str, Any]]:
    properties = client.list_all("/properties", params={"client_id": client_id})
    by_id = {int(item["id"]): item for item in properties if "id" in item}

    found: list[dict[str, Any]] = []
    wanted = set(area_names)
    for prop_id, prop in by_id.items():
        areas = client.list_all("/irrigation-areas", params={"property_id": prop_id})
        for area in areas:
            name = str(area.get("name") or "")
            if name in wanted:
                found.append(
                    {
                        "id": int(area["id"]),
                        "name": name,
                        "property_name": prop.get("name"),
                    }
                )
    missing = [name for name in area_names if name not in {f["name"] for f in found}]
    if missing:
        raise RuntimeError(
            f"No se encontraron areas objetivo: {', '.join(missing)}"
        )
    return sorted(found, key=lambda row: int(row["id"]))


def _upsert_area_thresholds(
    client: ApiClient,
    *,
    area_id: int,
    rules: tuple[ThresholdRule, ...],
) -> list[dict[str, Any]]:
    existing = client.list_all("/thresholds", params={"irrigation_area_id": area_id})
    by_parameter = {
        str(item.get("parameter") or ""): item
        for item in existing
        if item.get("parameter") in PRIORITY_PARAMETERS
    }

    applied: list[dict[str, Any]] = []
    for rule in rules:
        payload = {
            "irrigation_area_id": area_id,
            "parameter": rule.parameter,
            "min_value": rule.min_value,
            "max_value": rule.max_value,
            "severity": rule.severity,
            "active": True,
        }
        current = by_parameter.get(rule.parameter)
        if current is None:
            row = client.post("/thresholds", payload)
            action = "created"
        else:
            row = client.put(f"/thresholds/{current['id']}", payload)
            action = "updated"
        applied.append(
            {
                "action": action,
                "id": row.get("id"),
                "parameter": row.get("parameter"),
                "min_value": row.get("min_value"),
                "max_value": row.get("max_value"),
                "severity": row.get("severity"),
                "active": row.get("active"),
            }
        )
    return applied


def main() -> int:
    args = parse_args()
    area_names = args.area_names[:] if args.area_names else DEFAULT_AREA_NAMES[:]
    rules = PROFILES[args.profile]

    token = _login(args.base_url, args.admin_email, args.admin_password)
    client = ApiClient(args.base_url).with_token(token)

    client_id = _resolve_client_id(client, args.client_email)
    target_areas = _resolve_target_areas(
        client,
        client_id=client_id,
        area_names=area_names,
    )

    print(f"[ok] client_id {args.client_email}: {client_id}")
    print(f"[ok] perfil: {args.profile}")

    for area in target_areas:
        print(
            f"\n[area] {area['name']} (id={area['id']}) predio={area['property_name']}"
        )
        applied = _upsert_area_thresholds(
            client,
            area_id=int(area["id"]),
            rules=rules,
        )
        for row in applied:
            print(
                "  - {action} threshold#{id} {parameter} "
                "[{min_value}, {max_value}] sev={severity} active={active}".format(
                    **row
                )
            )

    print("\n[done] Umbrales aplicados correctamente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
