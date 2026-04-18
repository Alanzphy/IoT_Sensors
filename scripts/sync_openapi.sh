#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DEFAULT_URL="http://127.0.0.1:5050/api/v1/openapi.json"
OPENAPI_URL="${OPENAPI_URL:-$DEFAULT_URL}"

if [[ ! -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  echo "ERROR: Python virtualenv not found at $BACKEND_DIR/.venv/bin/python" >&2
  echo "Tip: create backend venv and install dependencies first." >&2
  exit 1
fi

TMP_JSON="$(mktemp)"
cleanup() {
  rm -f "$TMP_JSON"
}
trap cleanup EXIT

echo "Fetching OpenAPI from: $OPENAPI_URL"
curl -fsS "$OPENAPI_URL" -o "$TMP_JSON"

"$BACKEND_DIR/.venv/bin/python" - "$TMP_JSON" "$ROOT_DIR/openapi.yaml" "$ROOT_DIR/docs/openapi.yaml" <<'PY'
import json
import sys
from pathlib import Path

src = Path(sys.argv[1])
targets = [Path(p) for p in sys.argv[2:]]
obj = json.loads(src.read_text(encoding="utf-8"))

# Prefer YAML output for readability; fallback to JSON (valid YAML subset) if PyYAML is unavailable.
try:
    import yaml  # type: ignore
    rendered = yaml.safe_dump(obj, sort_keys=False, allow_unicode=True)
    fmt = "yaml"
except Exception:
    rendered = json.dumps(obj, indent=2, ensure_ascii=False)
    fmt = "json-as-yaml"

if not rendered.endswith("\n"):
    rendered += "\n"

for target in targets:
    target.write_text(rendered, encoding="utf-8")
    print(f"updated: {target} ({fmt})")

paths = obj.get("paths", {})
for required in ("/api/v1/alerts", "/api/v1/thresholds", "/api/v1/audit-logs"):
    if required not in paths:
        print(f"warning: expected path not found in runtime schema: {required}", file=sys.stderr)
PY

echo "OpenAPI sync completed."
