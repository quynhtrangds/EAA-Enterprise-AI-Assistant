#!/usr/bin/env bash
# ==============================================================================
# Enterprise AI Assistant - PostgreSQL Database Restore Script
# ==============================================================================
# Usage: ./scripts/restore-db.sh <path_to_backup_file>
# Example: ./scripts/restore-db.sh ./backups/eaa_backup_enterprise_ai_demo_20260810_120000.sql.gz
# ==============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file>" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${POSTGRES_CONTAINER:-enterprise_ai_postgres}"
POSTGRES_DB="${POSTGRES_DB:-enterprise_ai_demo}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found!" >&2
  exit 1
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Restoring database '${POSTGRES_DB}' from '${BACKUP_FILE}'..."

if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
else
  docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${BACKUP_FILE}"
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Database restore completed successfully."
