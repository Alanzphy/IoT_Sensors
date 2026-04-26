#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SIM_BASE_URL:-https://sensores.alanrz.bond/api/v1}"
KEYS_FILE="${SIM_KEYS_FILE:-./keys_partner_vps.txt}"
ADMIN_EMAIL="${SIM_ADMIN_EMAIL:-admin@sensores.com}"
ADMIN_PASSWORD="${SIM_ADMIN_PASSWORD:-}"
INTERVAL="${SIM_INTERVAL:-2}"
DISPATCH_INTERVAL="${SIM_DISPATCH_INTERVAL:-20}"
DISPATCH_LIMIT="${SIM_DISPATCH_LIMIT:-200}"
AI_REPORT_DAYS="${SIM_AI_REPORT_DAYS:-7}"
AI_REPORT_INITIAL_DELAY="${SIM_AI_REPORT_INITIAL_DELAY:-15}"
AI_REPORT_INTERVAL="${SIM_AI_REPORT_INTERVAL:-20}"

if [[ -z "${ADMIN_PASSWORD}" ]]; then
  echo "Falta SIM_ADMIN_PASSWORD."
  echo "Ejemplo:"
  echo "  SIM_ADMIN_PASSWORD='TU_PASSWORD' ./run_partner_vps.sh"
  exit 1
fi

if [[ ! -f "${KEYS_FILE}" ]]; then
  echo "No existe el archivo de keys: ${KEYS_FILE}"
  echo "Generalo con:"
  echo "  python3 scripts/setup_partner_locations.py --base-url ${BASE_URL} --admin-email ${ADMIN_EMAIL} --admin-password 'TU_PASSWORD' --write-keys-file simulator/keys_partner_vps.txt"
  exit 1
fi

echo "Iniciando simulador partner VPS..."
echo "  BASE_URL=${BASE_URL}"
echo "  KEYS_FILE=${KEYS_FILE}"
echo "  ADMIN_EMAIL=${ADMIN_EMAIL}"

python3 simulator_fast.py \
  --api-keys-file "${KEYS_FILE}" \
  --base-url "${BASE_URL}" \
  --mode demo-alerts \
  --interval "${INTERVAL}" \
  --dispatch-notifications \
  --dispatch-interval "${DISPATCH_INTERVAL}" \
  --dispatch-limit "${DISPATCH_LIMIT}" \
  --admin-email "${ADMIN_EMAIL}" \
  --admin-password "${ADMIN_PASSWORD}" \
  --ai-weekly-report \
  --ai-weekly-report-per-key-area \
  --ai-weekly-report-force \
  --ai-weekly-report-days "${AI_REPORT_DAYS}" \
  --ai-weekly-report-initial-delay "${AI_REPORT_INITIAL_DELAY}" \
  --ai-weekly-report-interval "${AI_REPORT_INTERVAL}"
