#!/usr/bin/env bash
# ==============================================================================
# Enterprise AI Assistant - Proactive Service Health Monitoring & Alert Script
# ==============================================================================
# Usage: ./scripts/monitor-health.sh [webhook_url]
# Can be scheduled via crontab (e.g., */5 * * * * ./scripts/monitor-health.sh)
# ==============================================================================

set -euo pipefail

WEBHOOK_URL="${1:-${WEBHOOK_URL:-}}"
ORCHESTRATOR_URL="${AI_ORCHESTRATOR_URL:-http://localhost:8082}"
GATEWAY_URL="${MCP_GATEWAY_URL:-http://localhost:8081}"
CHAT_UI_URL="${CHAT_UI_URL:-http://localhost:3000}"

FAILED_SERVICES=()

check_service() {
  local name="$1"
  local url="$2"
  
  echo -n "[$(date +'%Y-%m-%d %H:%M:%S')] Checking ${name} (${url})... "
  
  if http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${url}"); then
    if [ "${http_code}" -eq 200 ]; then
      echo "OK (200)"
    else
      echo "FAILED (HTTP ${http_code})"
      FAILED_SERVICES+=("${name} (HTTP ${http_code})")
    fi
  else
    echo "UNREACHABLE"
    FAILED_SERVICES+=("${name} (Unreachable)")
  fi
}

check_service "MCP Gateway" "${GATEWAY_URL}/health"
check_service "AI Orchestrator" "${ORCHESTRATOR_URL}/health"
check_service "Chat UI" "${CHAT_UI_URL}/"

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  MSG="⚠️ [ALERT] Enterprise AI Assistant service health failure detected!\nFailed services:\n"
  for s in "${FAILED_SERVICES[@]}"; do
    MSG="${MSG} - ${s}\n"
  done
  
  echo -e "\n${MSG}" >&2

  if [ -n "${WEBHOOK_URL}" ]; then
    echo "Sending alert to webhook..."
    curl -s -X POST -H "Content-Type: application/json" \
      -d "{\"text\": \"${MSG}\"}" "${WEBHOOK_URL}" || true
  fi
  exit 1
else
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] All services healthy."
  exit 0
fi
