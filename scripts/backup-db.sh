#!/usr/bin/env bash
# ==============================================================================
# Enterprise AI Assistant - Automated PostgreSQL Database Backup Script
# ==============================================================================
# Usage: ./scripts/backup-db.sh [backup_dir]
# Options:
#   backup_dir  - Directory where backups are saved (default: ./backups)
# Retention: Retains the last 30 daily backups automatically.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%HM%S")
CONTAINER_NAME="${POSTGRES_CONTAINER:-enterprise_ai_postgres}"
POSTGRES_DB="${POSTGRES_DB:-enterprise_ai_demo}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/eaa_backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting database backup for '${POSTGRES_DB}'..."

if docker exec "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Backup created successfully: ${BACKUP_FILE} (${FILE_SIZE})"
else
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR: Database backup failed!" >&2
  exit 1
fi

# Cleanup backups older than retention days
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "eaa_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup process complete."
