#!/bin/sh
# ============================================================================
# Backup PostgreSQL của EAA vào database/backups/ (bản sh cho WSL/Git Bash/Linux).
# Phục hồi: docker exec -i enterprise_ai_postgres psql -U postgres -d enterprise_ai_demo < <file.sql>
# ============================================================================
set -e
STAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

mkdir -p database/backups
BACKUP_NAME="enterprise_ai_demo_${STAMP}.sql"

docker exec enterprise_ai_postgres sh -c "pg_dump -U postgres -d enterprise_ai_demo -f /backup/$BACKUP_NAME"

if [ -f "database/backups/$BACKUP_NAME" ]; then
  SIZE=$(du -k "database/backups/$BACKUP_NAME" | cut -f1)
  echo "Backup thành công: database/backups/$BACKUP_NAME (${SIZE} KB)"
else
  echo "Backup THẤT BẠI — kiểm tra container enterprise_ai_postgres đang chạy chưa." >&2
  exit 1
fi
