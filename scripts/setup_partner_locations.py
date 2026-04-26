#!/usr/bin/env python3
"""
Configura ubicaciones del socio formador para el cliente alan2203mx@gmail.com.

Implementa por API (sin tocar esquema):
1) Crea predios/areas/nodos productivos:
   - Granja Hogar
   - Campus Reforestado
2) Mantiene lo existente y marca dataset legado como demo con prefijo "DEMO -".
3) Es idempotente: puede ejecutarse multiples veces sin duplicar entidades.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "http://localhost:5050/api/v1"
DEFAULT_ADMIN_EMAIL = "admin@sensores.com"
DEFAULT_ADMIN_PASSWORD = "admin123"
TARGET_CLIENT_EMAIL = "alan2203mx@gmail.com"
DEMO_PREFIX = "DEMO - "
DEFAULT_HTTP_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
    "SensoresIoT-SetupPartner/1.0"
)

LEGACY_DEMO_PROPERTY_NAME = "Rancho Norte"
DEMO_PROPERTY_NAME = f"{DEMO_PREFIX}Rancho Norte"
LEGACY_DEMO_AREA_NAMES = {"Nogal Norte", "Alfalfa Este", "Chile Principal", "Área 2"}
LEGACY_DEMO_NODE_NAMES = {
    "Nodo Nogal Norte",
    "Nodo Alfalfa Este",
    "Nodo Chile Principal",
    "Nodo Prueba E2E",
}
DEFAULT_SOURCE_DEMO_AREA_NAME = f"{DEMO_PREFIX}Nogal Norte"
LEGACY_SOURCE_DEMO_AREA_NAME = "Nogal Norte"


@dataclass(frozen=True)
class PartnerSite:
    property_name: str
    location: str
    area_name: str
    crop_name: str
    area_size: float
    node_name: str
    latitude: float
    longitude: float


PARTNER_SITES = [
    PartnerSite(
        property_name="Granja Hogar",
        location="28.6850292,-106.0765387",
        area_name="Area Granja Hogar",
        crop_name="Nogal",
        area_size=1.0,
        node_name="Nodo Granja Hogar",
        latitude=28.6850292,
        longitude=-106.0765387,
    ),
    PartnerSite(
        property_name="Campus Reforestado",
        location="28.6753139,-106.077902",
        area_name="Area Campus Reforestado",
        crop_name="Nogal",
        area_size=1.0,
        node_name="Nodo Campus Reforestado",
        latitude=28.6753139,
        longitude=-106.077902,
    ),
]


def _prefix_demo(name: str) -> str:
    return name if name.startswith(DEMO_PREFIX) else f"{DEMO_PREFIX}{name}"


class ApiClient:
    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        user_agent: str = DEFAULT_HTTP_USER_AGENT,
    ):
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
        headers: dict[str, str] | None = None,
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
        if headers:
            for key, value in headers.items():
                req.add_header(key, value)

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

    def get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        status, payload = self._request("GET", path, params=params, headers=headers)
        if status != 200:
            raise RuntimeError(f"GET {path} fallo (HTTP {status}): {payload}")
        return payload

    def post(
        self,
        path: str,
        payload: dict[str, Any],
        *,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        status, parsed = self._request("POST", path, payload=payload, headers=headers)
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
        items: list[dict[str, Any]] = []
        base = dict(params or {})
        while True:
            payload = self.get(path, params={**base, "page": page, "per_page": 200})
            batch = payload.get("data") or []
            if not isinstance(batch, list):
                raise RuntimeError(f"Respuesta inesperada en {path}: {payload}")
            items.extend(batch)
            total = int(payload.get("total") or 0)
            if len(items) >= total or not batch:
                break
            page += 1
        return items


def _login(base_url: str, email: str, password: str, *, user_agent: str) -> str:
    public_client = ApiClient(base_url, user_agent=user_agent)
    payload = public_client.post("/auth/login", {"email": email, "password": password})
    token = payload.get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError(f"Login sin access_token: {payload}")
    return token


def _find_client_id_by_email(client: ApiClient, email: str) -> int:
    clients = client.list_all("/clients")
    for item in clients:
        user = item.get("user") or {}
        if isinstance(user, dict) and user.get("email") == email:
            return int(item["id"])
    raise RuntimeError(f"No se encontro client_id para email '{email}'")


def _find_crop_type_id(client: ApiClient, crop_name: str) -> int:
    crop_types = client.list_all("/crop-types")
    for crop in crop_types:
        if crop.get("name") == crop_name:
            return int(crop["id"])
    raise RuntimeError(f"No se encontro crop_type_id para cultivo '{crop_name}'")


def _upsert_property(client: ApiClient, *, client_id: int, name: str, location: str) -> dict[str, Any]:
    properties = client.list_all("/properties", params={"client_id": client_id})
    for prop in properties:
        if prop.get("name") == name:
            if prop.get("location") != location:
                return client.put(
                    f"/properties/{prop['id']}",
                    {"name": name, "location": location},
                )
            return prop
    return client.post(
        "/properties",
        {"client_id": client_id, "name": name, "location": location},
    )


def _upsert_area(
    client: ApiClient,
    *,
    property_id: int,
    crop_type_id: int,
    name: str,
    area_size: float,
) -> dict[str, Any]:
    areas = client.list_all("/irrigation-areas", params={"property_id": property_id})
    for area in areas:
        if area.get("name") == name:
            patch: dict[str, Any] = {}
            if int(area.get("crop_type_id")) != crop_type_id:
                patch["crop_type_id"] = crop_type_id
            current_size = area.get("area_size")
            if current_size is None or float(current_size) != float(area_size):
                patch["area_size"] = area_size
            if patch:
                patch["name"] = name
                return client.put(f"/irrigation-areas/{area['id']}", patch)
            return area
    return client.post(
        "/irrigation-areas",
        {
            "property_id": property_id,
            "crop_type_id": crop_type_id,
            "name": name,
            "area_size": area_size,
        },
    )


def _upsert_node(
    client: ApiClient,
    *,
    irrigation_area_id: int,
    name: str,
    latitude: float,
    longitude: float,
) -> dict[str, Any]:
    nodes = client.list_all("/nodes", params={"irrigation_area_id": irrigation_area_id})
    if nodes:
        target = nodes[0]
        payload = {
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "is_active": True,
        }
        return client.put(f"/nodes/{target['id']}", payload)

    created = client.post(
        "/nodes",
        {
            "irrigation_area_id": irrigation_area_id,
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "is_active": True,
        },
    )
    return created


def _rename_legacy_demo_entities(client: ApiClient, *, client_id: int) -> None:
    properties = client.list_all("/properties", params={"client_id": client_id})
    by_name = {item.get("name"): item for item in properties}

    legacy_property = by_name.get(LEGACY_DEMO_PROPERTY_NAME)
    if legacy_property:
        print(f"[rename] Predio '{LEGACY_DEMO_PROPERTY_NAME}' -> '{DEMO_PROPERTY_NAME}'")
        client.put(
            f"/properties/{legacy_property['id']}",
            {
                "name": DEMO_PROPERTY_NAME,
                "location": legacy_property.get("location") or "Sonora, México",
            },
        )

    properties = client.list_all("/properties", params={"client_id": client_id})
    demo_property = next((p for p in properties if p.get("name") == DEMO_PROPERTY_NAME), None)
    if not demo_property:
        return

    areas = client.list_all("/irrigation-areas", params={"property_id": int(demo_property["id"])})
    for area in areas:
        area_name = str(area.get("name") or "")
        if area_name in LEGACY_DEMO_AREA_NAMES:
            new_name = _prefix_demo(area_name)
            print(f"[rename] Area '{area_name}' -> '{new_name}'")
            client.put(
                f"/irrigation-areas/{area['id']}",
                {
                    "name": new_name,
                    "crop_type_id": int(area["crop_type_id"]),
                    "area_size": float(area.get("area_size") or 1.0),
                },
            )

        nodes = client.list_all("/nodes", params={"irrigation_area_id": int(area["id"])})
        for node in nodes:
            node_name = str(node.get("name") or "")
            if node_name in LEGACY_DEMO_NODE_NAMES:
                new_name = _prefix_demo(node_name)
                print(f"[rename] Nodo '{node_name}' -> '{new_name}'")
                client.put(
                    f"/nodes/{node['id']}",
                    {
                        "name": new_name,
                        "latitude": node.get("latitude"),
                        "longitude": node.get("longitude"),
                        "is_active": bool(node.get("is_active")),
                    },
                )


def _ensure_demo_property_prefixed(client: ApiClient, *, client_id: int) -> None:
    properties = client.list_all("/properties", params={"client_id": client_id})
    demo_property = next((p for p in properties if p.get("name") == DEMO_PROPERTY_NAME), None)
    if demo_property:
        return

    legacy = next((p for p in properties if p.get("name") == LEGACY_DEMO_PROPERTY_NAME), None)
    if legacy:
        print(f"[rename] Predio '{LEGACY_DEMO_PROPERTY_NAME}' -> '{DEMO_PROPERTY_NAME}'")
        client.put(
            f"/properties/{legacy['id']}",
            {"name": DEMO_PROPERTY_NAME, "location": legacy.get("location") or "Sonora, México"},
        )


def _collect_partner_node_summaries(
    client: ApiClient,
    *,
    client_id: int,
) -> list[dict[str, Any]]:
    geo = client.list_all(
        "/nodes/geo",
        params={"client_id": client_id, "include_without_coordinates": "true"},
    )
    partner_names = {site.node_name for site in PARTNER_SITES}
    out: list[dict[str, Any]] = []
    for item in geo:
        if item.get("name") in partner_names:
            out.append(item)
    return out


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(candidate)
    except ValueError:
        return None


def _find_property_by_name(
    client: ApiClient, *, client_id: int, name: str
) -> dict[str, Any] | None:
    properties = client.list_all("/properties", params={"client_id": client_id})
    return next((item for item in properties if item.get("name") == name), None)


def _find_area_by_name(
    client: ApiClient, *, property_id: int, name: str
) -> dict[str, Any] | None:
    areas = client.list_all("/irrigation-areas", params={"property_id": property_id})
    return next((item for item in areas if item.get("name") == name), None)


def _resolve_source_demo_area(
    client: ApiClient,
    *,
    client_id: int,
    source_area_name: str,
) -> dict[str, Any]:
    demo_property = _find_property_by_name(client, client_id=client_id, name=DEMO_PROPERTY_NAME)
    if not demo_property:
        demo_property = _find_property_by_name(
            client, client_id=client_id, name=LEGACY_DEMO_PROPERTY_NAME
        )
    if not demo_property:
        raise RuntimeError(
            f"No se encontro predio demo '{DEMO_PROPERTY_NAME}' ni '{LEGACY_DEMO_PROPERTY_NAME}'"
        )

    property_id = int(demo_property["id"])
    source_area = _find_area_by_name(client, property_id=property_id, name=source_area_name)
    if not source_area:
        source_area = _find_area_by_name(
            client,
            property_id=property_id,
            name=(
                LEGACY_SOURCE_DEMO_AREA_NAME
                if source_area_name == DEFAULT_SOURCE_DEMO_AREA_NAME
                else DEFAULT_SOURCE_DEMO_AREA_NAME
            ),
        )

    if not source_area:
        areas = client.list_all("/irrigation-areas", params={"property_id": property_id})
        if not areas:
            raise RuntimeError(f"El predio demo '{demo_property.get('name')}' no tiene areas")
        source_area = areas[0]
        print(
            f"[warn] No encontre area fuente '{source_area_name}', "
            f"usando '{source_area.get('name')}'"
        )
    return source_area


def _clone_recent_readings(
    client: ApiClient,
    *,
    source_area_id: int,
    target_area_id: int,
    target_node_api_key: str,
) -> tuple[int, int]:
    latest_target = client.get(
        "/readings/latest",
        params={"irrigation_area_id": target_area_id},
    )
    latest_target_ts = _parse_iso_datetime(latest_target.get("timestamp"))
    copied = 0
    skipped = 0
    page = 1

    while True:
        payload = client.get(
            "/readings",
            params={
                "irrigation_area_id": source_area_id,
                "page": page,
                "per_page": 200,
            },
        )
        rows = payload.get("data") or []
        if not rows:
            break

        for row in rows:
            ts = _parse_iso_datetime(row.get("timestamp"))
            if latest_target_ts and ts and ts <= latest_target_ts:
                return copied, skipped

            reading_payload = {
                "timestamp": row.get("timestamp"),
                "soil": row.get("soil") or {},
                "irrigation": row.get("irrigation") or {},
                "environmental": row.get("environmental") or {},
            }
            try:
                client.post(
                    "/readings",
                    reading_payload,
                    headers={"X-API-Key": target_node_api_key},
                )
                copied += 1
            except RuntimeError:
                skipped += 1
        page += 1

    return copied, skipped


def _clone_thresholds(
    client: ApiClient, *, source_area_id: int, target_area_id: int
) -> tuple[int, int]:
    source_thresholds = client.list_all(
        "/thresholds",
        params={"irrigation_area_id": source_area_id, "active": "true"},
    )
    target_thresholds = client.list_all(
        "/thresholds",
        params={"irrigation_area_id": target_area_id, "active": "true"},
    )
    target_by_parameter = {item.get("parameter"): item for item in target_thresholds}
    created = 0
    updated = 0

    for threshold in source_thresholds:
        parameter = threshold.get("parameter")
        if not parameter:
            continue
        payload = {
            "irrigation_area_id": target_area_id,
            "parameter": parameter,
            "min_value": threshold.get("min_value"),
            "max_value": threshold.get("max_value"),
            "severity": threshold.get("severity") or "warning",
            "active": bool(threshold.get("active", True)),
        }
        current = target_by_parameter.get(parameter)
        if current:
            same = (
                current.get("min_value") == payload["min_value"]
                and current.get("max_value") == payload["max_value"]
                and current.get("severity") == payload["severity"]
                and bool(current.get("active")) == payload["active"]
            )
            if not same:
                client.put(f"/thresholds/{current['id']}", payload)
                updated += 1
        else:
            client.post("/thresholds", payload)
            created += 1

    return created, updated


def _clone_notification_preferences_if_possible(
    admin_client: ApiClient,
    *,
    client_user_email: str,
    client_user_password: str | None,
    source_area_id: int,
    target_area_ids: list[int],
) -> tuple[int, int]:
    if not client_user_password:
        print(
            "[warn] No se clonan preferencias de notificacion (falta --client-password)."
        )
        return 0, 0

    client_token = _login(
        admin_client.base_url,
        client_user_email,
        client_user_password,
        user_agent=admin_client.user_agent,
    )
    client_api = admin_client.with_token(client_token)

    source_prefs = admin_client.list_all(
        "/notification-preferences",
        params={"irrigation_area_id": source_area_id},
    )
    if not source_prefs:
        return 0, 0

    items: list[dict[str, Any]] = []
    for target_area_id in target_area_ids:
        for pref in source_prefs:
            items.append(
                {
                    "irrigation_area_id": target_area_id,
                    "alert_type": pref.get("alert_type"),
                    "severity": pref.get("severity"),
                    "channel": pref.get("channel"),
                    "enabled": bool(pref.get("enabled")),
                }
            )

    result = client_api.put("/notification-preferences/bulk", {"items": items})
    return int(result.get("created") or 0), int(result.get("updated") or 0)


def _write_keys_file(path: str, partner_nodes: list[dict[str, Any]]) -> None:
    lines = ["# API keys productivas socio formador", ""]
    for node in sorted(partner_nodes, key=lambda x: str(x.get("name") or "")):
        lines.append(f"# {node.get('name')} ({node.get('irrigation_area_name')})")
        lines.append(str(node.get("api_key")))
    lines.append("")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    print(f"[ok] Archivo de API keys generado: {path}")


def run(args: argparse.Namespace) -> int:
    token = _login(
        args.base_url,
        args.admin_email,
        args.admin_password,
        user_agent=args.user_agent,
    )
    api = ApiClient(args.base_url, token, args.user_agent)

    client_id = _find_client_id_by_email(api, TARGET_CLIENT_EMAIL)
    crop_type_id = _find_crop_type_id(api, "Nogal")

    print(f"[ok] client_id de {TARGET_CLIENT_EMAIL}: {client_id}")
    print(f"[ok] crop_type_id Nogal: {crop_type_id}")

    _ensure_demo_property_prefixed(api, client_id=client_id)
    _rename_legacy_demo_entities(api, client_id=client_id)

    target_area_ids: list[int] = []
    target_nodes: list[dict[str, Any]] = []

    for site in PARTNER_SITES:
        prop = _upsert_property(
            api,
            client_id=client_id,
            name=site.property_name,
            location=site.location,
        )
        area = _upsert_area(
            api,
            property_id=int(prop["id"]),
            crop_type_id=crop_type_id,
            name=site.area_name,
            area_size=site.area_size,
        )
        node = _upsert_node(
            api,
            irrigation_area_id=int(area["id"]),
            name=site.node_name,
            latitude=site.latitude,
            longitude=site.longitude,
        )
        target_area_ids.append(int(area["id"]))
        target_nodes.append(node)
        print(
            f"[ok] {site.property_name} -> {site.area_name} -> {site.node_name} "
            f"(node_id={node.get('id')}, api_key={node.get('api_key')})"
        )

    if args.clone_demo_data:
        source_area = _resolve_source_demo_area(
            api,
            client_id=client_id,
            source_area_name=args.source_demo_area_name,
        )
        source_area_id = int(source_area["id"])
        print(
            f"\n[migrate] Clonando datos desde area demo '{source_area.get('name')}' "
            f"(area_id={source_area_id})"
        )

        readings_total_copied = 0
        readings_total_skipped = 0
        thresholds_total_created = 0
        thresholds_total_updated = 0

        for node, area_id in zip(target_nodes, target_area_ids, strict=True):
            api_key = str(node.get("api_key") or "")
            if not api_key:
                raise RuntimeError(f"Nodo destino sin api_key (area_id={area_id})")
            copied, skipped = _clone_recent_readings(
                api,
                source_area_id=source_area_id,
                target_area_id=area_id,
                target_node_api_key=api_key,
            )
            created, updated = _clone_thresholds(
                api,
                source_area_id=source_area_id,
                target_area_id=area_id,
            )
            readings_total_copied += copied
            readings_total_skipped += skipped
            thresholds_total_created += created
            thresholds_total_updated += updated
            print(
                f"[migrate] area_id={area_id}: readings_copied={copied}, "
                f"readings_skipped={skipped}, thresholds_created={created}, thresholds_updated={updated}"
            )

        prefs_created, prefs_updated = _clone_notification_preferences_if_possible(
            api,
            client_user_email=TARGET_CLIENT_EMAIL,
            client_user_password=args.client_password,
            source_area_id=source_area_id,
            target_area_ids=target_area_ids,
        )
        print(
            "[migrate] resumen: "
            f"readings_copied={readings_total_copied}, "
            f"readings_skipped={readings_total_skipped}, "
            f"thresholds_created={thresholds_total_created}, "
            f"thresholds_updated={thresholds_total_updated}, "
            f"notification_preferences_created={prefs_created}, "
            f"notification_preferences_updated={prefs_updated}"
        )

    partner_nodes = _collect_partner_node_summaries(api, client_id=client_id)
    print("\nResumen nodos productivos:")
    for node in sorted(partner_nodes, key=lambda x: str(x.get("name") or "")):
        print(
            f"  - {node.get('name')} | area={node.get('irrigation_area_name')} | "
            f"api_key={node.get('api_key')} | lat={node.get('latitude')} | lon={node.get('longitude')}"
        )

    if args.write_keys_file:
        _write_keys_file(args.write_keys_file, partner_nodes)

    print("\n[ok] Configuracion completada sin fallback.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Configura ubicaciones socio formador para cliente alan2203mx@gmail.com",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL del API (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--admin-email",
        default=DEFAULT_ADMIN_EMAIL,
        help=f"Correo admin (default: {DEFAULT_ADMIN_EMAIL})",
    )
    parser.add_argument(
        "--admin-password",
        default=DEFAULT_ADMIN_PASSWORD,
        help=f"Password admin (default: {DEFAULT_ADMIN_PASSWORD})",
    )
    parser.add_argument(
        "--write-keys-file",
        default="",
        help="Ruta opcional para guardar API keys productivas y usar en simulator_fast",
    )
    parser.add_argument(
        "--user-agent",
        default=DEFAULT_HTTP_USER_AGENT,
        help="User-Agent HTTP para evitar bloqueos de WAF/Cloudflare",
    )
    parser.add_argument(
        "--clone-demo-data",
        action=argparse.BooleanOptionalAction,
        default=True,
        help=(
            "Clona lecturas+umbrales del area demo fuente hacia Granja/Campus "
            "(default: enabled)"
        ),
    )
    parser.add_argument(
        "--client-password",
        default="",
        help=(
            "Password del cliente alan2203mx@gmail.com para clonar tambien "
            "notification-preferences (opcional)"
        ),
    )
    parser.add_argument(
        "--source-demo-area-name",
        default=DEFAULT_SOURCE_DEMO_AREA_NAME,
        help=(
            "Nombre del area demo fuente para clonar lecturas/umbrales "
            f"(default: {DEFAULT_SOURCE_DEMO_AREA_NAME})"
        ),
    )
    return parser.parse_args()


if __name__ == "__main__":
    try:
        raise SystemExit(run(parse_args()))
    except RuntimeError as exc:
        print(f"[error] {exc}")
        raise SystemExit(1)
