#!/usr/bin/env bash
set -euo pipefail

# Sync local MySQL (Docker) DB into VPS MySQL (Docker).
# - Creates local dump
# - Uploads to VPS
# - Creates VPS backup
# - Recreates target DB on VPS
# - Imports local dump
# - Restarts backend container (optional)

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

log() {
  echo "[INFO] $1"
}

usage() {
  cat <<'EOF'
Uso:
  ./scripts/sync_db_to_vps.sh \
    --ssh user@host \
    --remote-db-pass 'PASSWORD_VPS' \
    [opciones]

Opciones requeridas:
  --ssh TARGET                SSH target, ej: alanrz@51.222.87.178
  --remote-db-pass PASSWORD   Password de MySQL en VPS

Opciones opcionales:
  --db-name NAME              Base de datos (default: sensores_riego)
  --local-db-user USER        Usuario DB local (default: root)
  --local-db-pass PASS        Password DB local (default: rootpass)
  --remote-db-user USER       Usuario DB VPS (default: root)
  --local-mysql-container C   Contenedor MySQL local (default: sensores_mysql)
  --remote-mysql-container C  Contenedor MySQL VPS (default: sensores_mysql)
  --remote-backend-container C Contenedor backend VPS (default: sensores_backend)
  --remote-dir PATH           Directorio temporal en VPS (default: /tmp)
  --ssh-port PORT             Puerto SSH (default: 22)
  --no-backend-restart        No reinicia backend al final
  --yes                       No pedir confirmación interactiva
  -h, --help                  Mostrar ayuda

Ejemplo:
  ./scripts/sync_db_to_vps.sh \
    --ssh alanrz@51.222.87.178 \
    --remote-db-pass 'MiPassVPS' \
    --db-name sensores_riego \
    --yes
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando requerido no encontrado: $1"
}

SSH_TARGET=""
REMOTE_DB_PASS=""
DB_NAME="sensores_riego"
LOCAL_DB_USER="root"
LOCAL_DB_PASS="rootpass"
REMOTE_DB_USER="root"
LOCAL_MYSQL_CONTAINER="sensores_mysql"
REMOTE_MYSQL_CONTAINER="sensores_mysql"
REMOTE_BACKEND_CONTAINER="sensores_backend"
REMOTE_DIR="/tmp"
SSH_PORT="22"
RESTART_BACKEND="true"
AUTO_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh)
      SSH_TARGET="${2:-}"
      shift 2
      ;;
    --remote-db-pass)
      REMOTE_DB_PASS="${2:-}"
      shift 2
      ;;
    --db-name)
      DB_NAME="${2:-}"
      shift 2
      ;;
    --local-db-user)
      LOCAL_DB_USER="${2:-}"
      shift 2
      ;;
    --local-db-pass)
      LOCAL_DB_PASS="${2:-}"
      shift 2
      ;;
    --remote-db-user)
      REMOTE_DB_USER="${2:-}"
      shift 2
      ;;
    --local-mysql-container)
      LOCAL_MYSQL_CONTAINER="${2:-}"
      shift 2
      ;;
    --remote-mysql-container)
      REMOTE_MYSQL_CONTAINER="${2:-}"
      shift 2
      ;;
    --remote-backend-container)
      REMOTE_BACKEND_CONTAINER="${2:-}"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="${2:-}"
      shift 2
      ;;
    --ssh-port)
      SSH_PORT="${2:-}"
      shift 2
      ;;
    --no-backend-restart)
      RESTART_BACKEND="false"
      shift
      ;;
    --yes)
      AUTO_YES="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Opción desconocida: $1"
      ;;
  esac
done

[[ -n "$SSH_TARGET" ]] || fail "Falta --ssh"
[[ -n "$REMOTE_DB_PASS" ]] || fail "Falta --remote-db-pass"

require_cmd docker
require_cmd ssh
require_cmd scp
require_cmd mktemp

if [[ "$AUTO_YES" != "true" ]]; then
  echo
  echo "Esta operación reemplazará la BD '$DB_NAME' en el VPS."
  echo "Se generará backup previo en VPS, pero la BD remota será recreada."
  read -r -p "Escribe SI para continuar: " confirm
  [[ "$confirm" == "SI" ]] || fail "Operación cancelada."
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TS="$(date +%Y%m%d_%H%M%S)"
LOCAL_DUMP_FILE="$TMP_DIR/${DB_NAME}_${TS}.sql"
REMOTE_DUMP_FILE="${REMOTE_DIR%/}/$(basename "$LOCAL_DUMP_FILE")"

log "Verificando contenedor MySQL local: $LOCAL_MYSQL_CONTAINER"
docker ps --format '{{.Names}}' | rg -x "$LOCAL_MYSQL_CONTAINER" >/dev/null 2>&1 || \
  fail "No encuentro contenedor local '$LOCAL_MYSQL_CONTAINER' en ejecución."

log "Generando dump local de '$DB_NAME'..."
docker exec \
  -e MYSQL_PWD="$LOCAL_DB_PASS" \
  "$LOCAL_MYSQL_CONTAINER" \
  mysqldump \
  -u"$LOCAL_DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" > "$LOCAL_DUMP_FILE"

[[ -s "$LOCAL_DUMP_FILE" ]] || fail "El dump local quedó vacío."
log "Dump local generado: $LOCAL_DUMP_FILE"

log "Subiendo dump al VPS: $SSH_TARGET:$REMOTE_DUMP_FILE"
scp -P "$SSH_PORT" "$LOCAL_DUMP_FILE" "$SSH_TARGET:$REMOTE_DUMP_FILE"

log "Ejecutando import en VPS..."
ssh -p "$SSH_PORT" "$SSH_TARGET" bash -s -- \
  "$REMOTE_MYSQL_CONTAINER" \
  "$REMOTE_DB_USER" \
  "$REMOTE_DB_PASS" \
  "$DB_NAME" \
  "$REMOTE_DUMP_FILE" \
  "$REMOTE_DIR" \
  "$REMOTE_BACKEND_CONTAINER" \
  "$RESTART_BACKEND" <<'EOS'
set -euo pipefail

REMOTE_MYSQL_CONTAINER="$1"
REMOTE_DB_USER="$2"
REMOTE_DB_PASS="$3"
DB_NAME="$4"
REMOTE_DUMP_FILE="$5"
REMOTE_DIR="$6"
REMOTE_BACKEND_CONTAINER="$7"
RESTART_BACKEND="$8"

log() {
  echo "[VPS] $1"
}

if ! docker ps --format '{{.Names}}' | grep -xq "$REMOTE_MYSQL_CONTAINER"; then
  echo "[VPS][FAIL] No encuentro contenedor MySQL '$REMOTE_MYSQL_CONTAINER' en ejecución." >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${REMOTE_DIR%/}/${DB_NAME}_before_sync_${TS}.sql"

log "Creando backup previo: $BACKUP_FILE"
docker exec \
  -e MYSQL_PWD="$REMOTE_DB_PASS" \
  "$REMOTE_MYSQL_CONTAINER" \
  mysqldump \
  -u"$REMOTE_DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" > "$BACKUP_FILE"

log "Recreando base de datos '$DB_NAME'"
docker exec \
  -e MYSQL_PWD="$REMOTE_DB_PASS" \
  "$REMOTE_MYSQL_CONTAINER" \
  mysql -u"$REMOTE_DB_USER" -e \
  "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

log "Importando dump en '$DB_NAME'"
cat "$REMOTE_DUMP_FILE" | docker exec -i \
  -e MYSQL_PWD="$REMOTE_DB_PASS" \
  "$REMOTE_MYSQL_CONTAINER" \
  mysql -u"$REMOTE_DB_USER" "$DB_NAME"

log "Limpieza del dump temporal"
rm -f "$REMOTE_DUMP_FILE"

if [[ "$RESTART_BACKEND" == "true" ]]; then
  if docker ps --format '{{.Names}}' | grep -xq "$REMOTE_BACKEND_CONTAINER"; then
    log "Reiniciando backend: $REMOTE_BACKEND_CONTAINER"
    docker restart "$REMOTE_BACKEND_CONTAINER" >/dev/null
  else
    log "No se encontró backend '$REMOTE_BACKEND_CONTAINER', se omite restart."
  fi
fi

log "Sincronización completada."
log "Backup previo disponible en: $BACKUP_FILE"
EOS

log "Listo. La BD remota '$DB_NAME' ya quedó sincronizada."
