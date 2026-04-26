#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sensores.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
GENERATE_NOTIFY="${GENERATE_NOTIFY:-false}"
GENERATE_FORCE="${GENERATE_FORCE:-true}"
START_DATETIME="${START_DATETIME:-}"
END_DATETIME="${END_DATETIME:-}"
CLIENT_ID="${CLIENT_ID:-}"
IRRIGATION_AREA_ID="${IRRIGATION_AREA_ID:-}"
AUTO_SCOPE="${AUTO_SCOPE:-true}"

usage() {
  cat <<'EOF'
Uso:
  ./scripts/smoke_ai_reports.sh --base-url https://sensores.alanrz.bond --admin-password 'PASSWORD'

Opciones:
  --base-url URL                 URL base (ej. https://sensores.alanrz.bond)
  --admin-email EMAIL            Email admin (default: admin@sensores.com)
  --admin-password PASSWORD      Password admin (requerido)
  --notify true|false            Enviar notificaciones al generar (default: false)
  --force true|false             Forzar generación aunque exista reporte (default: true)
  --start-datetime ISO8601       Inicio rango UTC opcional (ej. 2026-04-24T00:00:00Z)
  --end-datetime ISO8601         Fin rango UTC opcional (ej. 2026-04-25T00:00:00Z)
  --client-id ID                 Scope opcional por cliente
  --irrigation-area-id ID        Scope opcional por área
  --auto-scope true|false        Si no envías scope, toma uno automáticamente (default: true)
  -h, --help                     Mostrar ayuda

Ejemplo mínimo:
  ./scripts/smoke_ai_reports.sh \
    --base-url https://sensores.alanrz.bond \
    --admin-password 'TU_PASSWORD'
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --notify)
      GENERATE_NOTIFY="${2:-}"
      shift 2
      ;;
    --force)
      GENERATE_FORCE="${2:-}"
      shift 2
      ;;
    --start-datetime)
      START_DATETIME="${2:-}"
      shift 2
      ;;
    --end-datetime)
      END_DATETIME="${2:-}"
      shift 2
      ;;
    --client-id)
      CLIENT_ID="${2:-}"
      shift 2
      ;;
    --irrigation-area-id)
      IRRIGATION_AREA_ID="${2:-}"
      shift 2
      ;;
    --auto-scope)
      AUTO_SCOPE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[FAIL] Opción desconocida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

[[ -n "$BASE_URL" ]] || {
  echo "[FAIL] Falta --base-url" >&2
  usage
  exit 1
}
[[ -n "$ADMIN_PASSWORD" ]] || {
  echo "[FAIL] Falta --admin-password" >&2
  usage
  exit 1
}

API_URL="${BASE_URL%/}/api/v1"
ROOT_URL="${BASE_URL%/}"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

request() {
  local method="$1"
  local url="$2"
  local auth_token="${3:-}"
  local data="${4:-}"

  local auth_header=()
  if [[ -n "$auth_token" ]]; then
    auth_header=(-H "Authorization: Bearer $auth_token")
  fi

  local content_header=()
  if [[ -n "$data" ]]; then
    content_header=(-H "Content-Type: application/json")
  fi

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" "${auth_header[@]}" "${content_header[@]}" -d "$data" -w $'\n%{http_code}'
  else
    curl -sS -X "$method" "$url" "${auth_header[@]}" -w $'\n%{http_code}'
  fi
}

extract_code() {
  tail -n1
}

extract_body() {
  sed '$d'
}

json_extract() {
  local raw_json="$1"
  local path="$2"
  RAW_JSON="$raw_json" python3 - "$path" <<'PY'
import json
import os
import sys

path = sys.argv[1]
raw = os.environ.get("RAW_JSON", "")

try:
    data = json.loads(raw)
except Exception:
    print("")
    raise SystemExit(0)

current = data
for part in path.split("."):
    if part == "":
        continue
    if isinstance(current, list):
        try:
            idx = int(part)
            current = current[idx]
        except Exception:
            current = None
            break
    elif isinstance(current, dict):
        current = current.get(part)
    else:
        current = None
        break

if current is None:
    print("")
elif isinstance(current, (dict, list)):
    print(json.dumps(current, ensure_ascii=True))
else:
    print(str(current))
PY
}

build_generate_payload() {
  python3 - \
    "$GENERATE_NOTIFY" \
    "$GENERATE_FORCE" \
    "$START_DATETIME" \
    "$END_DATETIME" \
    "$CLIENT_ID" \
    "$IRRIGATION_AREA_ID" <<'PY'
import json
import sys

notify = sys.argv[1].lower() == "true"
force = sys.argv[2].lower() == "true"
start_dt = sys.argv[3]
end_dt = sys.argv[4]
client_id = sys.argv[5]
area_id = sys.argv[6]

payload = {
    "notify": notify,
    "force": force,
}

if start_dt:
    payload["start_datetime"] = start_dt
if end_dt:
    payload["end_datetime"] = end_dt
if client_id:
    payload["client_id"] = int(client_id)
if area_id:
    payload["irrigation_area_id"] = int(area_id)

print(json.dumps(payload, ensure_ascii=True))
PY
}

echo "== Smoke AI Reports =="
echo "Base: $ROOT_URL"
echo "API:  $API_URL"

# 1) Health
health_resp="$(request GET "$ROOT_URL/health")"
health_code="$(printf '%s' "$health_resp" | extract_code)"
[[ "$health_code" == "200" ]] || fail "Health check failed (HTTP $health_code)"
echo "[OK] health"

# 2) Login admin
login_payload="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
login_resp="$(request POST "$API_URL/auth/login" "" "$login_payload")"
login_code="$(printf '%s' "$login_resp" | extract_code)"
login_body="$(printf '%s' "$login_resp" | extract_body)"
[[ "$login_code" == "200" ]] || fail "Login failed (HTTP $login_code)"

access_token="$(json_extract "$login_body" "access_token")"
if [[ -z "$access_token" ]]; then
  echo "[DEBUG] login body: $login_body" >&2
  fail "No pude extraer access_token"
fi
echo "[OK] auth/login"

# 3) List AI reports
list_resp="$(request GET "$API_URL/ai-reports?page=1&per_page=5" "$access_token")"
list_code="$(printf '%s' "$list_resp" | extract_code)"
list_body="$(printf '%s' "$list_resp" | extract_body)"
[[ "$list_code" == "200" ]] || fail "List AI reports failed (HTTP $list_code)"
before_total="$(json_extract "$list_body" "total")"
echo "[OK] ai-reports list (before total=${before_total:-0})"

# 3.1) Auto-scope to avoid long-running generate over all targets
if [[ -z "$CLIENT_ID" && -z "$IRRIGATION_AREA_ID" && "${AUTO_SCOPE,,}" == "true" ]]; then
  auto_client_id="$(json_extract "$list_body" "data.0.client_id")"

  if [[ -z "$auto_client_id" ]]; then
    clients_resp="$(request GET "$API_URL/clients?page=1&per_page=1" "$access_token")"
    clients_code="$(printf '%s' "$clients_resp" | extract_code)"
    clients_body="$(printf '%s' "$clients_resp" | extract_body)"
    if [[ "$clients_code" == "200" ]]; then
      auto_client_id="$(json_extract "$clients_body" "data.0.id")"
    fi
  fi

  if [[ -n "$auto_client_id" ]]; then
    CLIENT_ID="$auto_client_id"
    echo "[INFO] Auto-scope habilitado: usando client_id=$CLIENT_ID para generación rápida."
  else
    echo "[WARN] Auto-scope no encontró client_id; se usará generación sin scope (puede tardar y dar timeout)."
  fi
fi

# 4) Generate AI report
gen_payload="$(build_generate_payload)"
echo "[INFO] generate payload: $gen_payload"
gen_resp="$(request POST "$API_URL/ai-reports/generate" "$access_token" "$gen_payload")"
gen_code="$(printf '%s' "$gen_resp" | extract_code)"
gen_body="$(printf '%s' "$gen_resp" | extract_body)"
[[ "$gen_code" == "200" ]] || fail "Generate AI report failed (HTTP $gen_code)"

generated_count="$(json_extract "$gen_body" "generated_count")"
skipped_count="$(json_extract "$gen_body" "skipped_count")"
failed_count="$(json_extract "$gen_body" "failed_count")"
report_id="$(json_extract "$gen_body" "report_ids.0")"

echo "[OK] ai-reports generate (generated=${generated_count:-0}, skipped=${skipped_count:-0}, failed=${failed_count:-0})"
[[ -n "$report_id" ]] || fail "No se devolvió report_id en la generación"

# 5) Detail AI report
detail_resp="$(request GET "$API_URL/ai-reports/$report_id" "$access_token")"
detail_code="$(printf '%s' "$detail_resp" | extract_code)"
detail_body="$(printf '%s' "$detail_resp" | extract_body)"
[[ "$detail_code" == "200" ]] || fail "AI report detail failed (HTTP $detail_code)"

status_value="$(json_extract "$detail_body" "status")"
summary_value="$(json_extract "$detail_body" "summary")"
recommendation_value="$(json_extract "$detail_body" "recommendation")"
error_detail_value="$(json_extract "$detail_body" "error_detail")"

echo "[OK] ai-reports detail (id=$report_id, status=${status_value:-unknown})"

if [[ "${status_value:-}" == "failed" ]]; then
  echo "[WARN] El reporte quedó en failed. error_detail=${error_detail_value:-N/D}"
fi

if [[ "${status_value:-}" == "completed" ]]; then
  [[ -n "$summary_value" ]] || fail "Reporte completed sin summary"
  [[ -n "$recommendation_value" ]] || fail "Reporte completed sin recommendation"
  echo "[OK] completed report fields"
fi

echo
echo "URLs UI:"
echo "  Admin list:    $ROOT_URL/admin/reportes-ia"
echo "  Cliente list:  $ROOT_URL/cliente/reportes-ia"
echo "  Admin detalle: $ROOT_URL/admin/reportes-ia/$report_id"
echo "  Cliente detalle:$ROOT_URL/cliente/reportes-ia/$report_id"
echo
echo "== Smoke AI Reports completado =="
