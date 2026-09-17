#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <dominio>"
  echo "Ejemplo: $0 sensores.alanrz.bond"
  exit 1
fi

DOMAIN="$1"
BASE_URL="https://${DOMAIN}"

echo "== Smoke check para ${BASE_URL} =="

echo "[1/3] Health"
health_body="$(curl -fsS "${BASE_URL}/health")"
health_compact="$(printf '%s' "${health_body}" | tr -d '[:space:]')"
if [[ "${health_compact}" != '{"status":"ok"}' ]]; then
  echo "FAIL health: expected JSON {\"status\":\"ok\"} (optional whitespace allowed)" >&2
  exit 1
fi
echo "OK health: ${health_body}"

echo "[2/3] OpenAPI docs"
curl -fsS -o /dev/null -w "OK docs: HTTP %{http_code}\n" "${BASE_URL}/api/v1/docs"

echo "[3/3] Frontend"
curl -fsS -o /dev/null -w "OK frontend: HTTP %{http_code}\n" "${BASE_URL}/"

echo "Smoke check completado."
