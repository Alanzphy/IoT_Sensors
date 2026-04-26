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

LEGACY_DEMO_PROPERTY_NAME = "Rancho Norte"
DEMO_PROPERTY_NAME = f"{DEMO_PREFIX}Rancho Norte"
LEGACY_DEMO_AREA_NAMES = {"Nogal Norte", "Alfalfa Este", "Chile Principal", "Área 2"}
LEGACY_DEMO_NODE_NAMES = {
    "Nodo Nogal Norte",
    "Nodo Alfalfa Este",
    "Nodo Chile Principal",
    "Nodo Prueba E2E",
}


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
    def __init__(self, base_url: str, token: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def with_token(self, token: str) -> "ApiClient":
        return ApiClient(self.base_url, token)

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


def _login(base_url: str, email: str, password: str) -> str:
    public_client = ApiClient(base_url)
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
    token = _login(args.base_url, args.admin_email, args.admin_password)
    api = ApiClient(args.base_url, token)

    client_id = _find_client_id_by_email(api, TARGET_CLIENT_EMAIL)
    crop_type_id = _find_crop_type_id(api, "Nogal")

    print(f"[ok] client_id de {TARGET_CLIENT_EMAIL}: {client_id}")
    print(f"[ok] crop_type_id Nogal: {crop_type_id}")

    _ensure_demo_property_prefixed(api, client_id=client_id)
    _rename_legacy_demo_entities(api, client_id=client_id)

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
        print(
            f"[ok] {site.property_name} -> {site.area_name} -> {site.node_name} "
            f"(node_id={node.get('id')}, api_key={node.get('api_key')})"
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
    return parser.parse_args()


if __name__ == "__main__":
    try:
        raise SystemExit(run(parse_args()))
    except RuntimeError as exc:
        print(f"[error] {exc}")
        raise SystemExit(1)
