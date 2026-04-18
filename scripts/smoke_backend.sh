#!/usr/bin/env bash
set -euo pipefail

BASE_API_URL="${BASE_API_URL:-http://127.0.0.1:5050/api/v1}"
BASE_ROOT_URL="${BASE_ROOT_URL:-http://127.0.0.1:5050}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sensores.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

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

echo "== Smoke backend =="
echo "API: $BASE_API_URL"

# 1) Health
health_resp="$(request GET "$BASE_ROOT_URL/health")"
health_code="$(printf '%s' "$health_resp" | extract_code)"
[[ "$health_code" == "200" ]] || fail "Health check failed (HTTP $health_code)"
echo "[OK] health"

# 2) Login (admin)
login_payload="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
login_resp="$(request POST "$BASE_API_URL/auth/login" "" "$login_payload")"
login_code="$(printf '%s' "$login_resp" | extract_code)"
login_body="$(printf '%s' "$login_resp" | extract_body)"
[[ "$login_code" == "200" ]] || fail "Login failed (HTTP $login_code)"

access_token="$(printf '%s' "$login_body" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
[[ -n "$access_token" ]] || fail "Could not parse access_token from login response"
echo "[OK] auth/login"

# 3) Core list endpoint (clients)
clients_resp="$(request GET "$BASE_API_URL/clients?page=1&per_page=1" "$access_token")"
clients_code="$(printf '%s' "$clients_resp" | extract_code)"
[[ "$clients_code" == "200" ]] || fail "Clients list failed (HTTP $clients_code)"
echo "[OK] clients list"

# 4) Alerts + Thresholds (Fase 2 Lite active APIs)
alerts_resp="$(request GET "$BASE_API_URL/alerts?page=1&per_page=5" "$access_token")"
alerts_code="$(printf '%s' "$alerts_resp" | extract_code)"
[[ "$alerts_code" == "200" ]] || fail "Alerts list failed (HTTP $alerts_code)"
echo "[OK] alerts list"

thresholds_resp="$(request GET "$BASE_API_URL/thresholds?page=1&per_page=5" "$access_token")"
thresholds_code="$(printf '%s' "$thresholds_resp" | extract_code)"
[[ "$thresholds_code" == "200" ]] || fail "Thresholds list failed (HTTP $thresholds_code)"
echo "[OK] thresholds list"

# 5) Readings latest (discover one irrigation area id)
areas_resp="$(request GET "$BASE_API_URL/irrigation-areas?page=1&per_page=1" "$access_token")"
areas_code="$(printf '%s' "$areas_resp" | extract_code)"
areas_body="$(printf '%s' "$areas_resp" | extract_body)"
[[ "$areas_code" == "200" ]] || fail "Irrigation areas list failed (HTTP $areas_code)"

area_id="$(printf '%s' "$areas_body" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1)"

if [[ -n "$area_id" ]]; then
  latest_resp="$(request GET "$BASE_API_URL/readings/latest?irrigation_area_id=$area_id" "$access_token")"
  latest_code="$(printf '%s' "$latest_resp" | extract_code)"
  if [[ "$latest_code" == "200" ]]; then
    echo "[OK] readings latest (area_id=$area_id)"
  elif [[ "$latest_code" == "404" ]]; then
    echo "[SKIP] readings latest (area_id=$area_id has no accessible latest reading in current dataset)"
  else
    fail "Readings latest failed (HTTP $latest_code)"
  fi
else
  echo "[SKIP] readings latest (no irrigation areas found in current database)"
fi

# 6) OpenAPI endpoint versioned
openapi_resp="$(request GET "$BASE_API_URL/openapi.json")"
openapi_code="$(printf '%s' "$openapi_resp" | extract_code)"
openapi_body="$(printf '%s' "$openapi_resp" | extract_body)"
[[ "$openapi_code" == "200" ]] || fail "OpenAPI endpoint failed (HTTP $openapi_code)"

printf '%s' "$openapi_body" | rg -q '/api/v1/alerts|/api/v1/thresholds' || fail "OpenAPI does not include alerts/thresholds"
echo "[OK] openapi contains alerts/thresholds"

echo "== Smoke backend completed successfully =="
