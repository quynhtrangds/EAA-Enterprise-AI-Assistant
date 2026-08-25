# ============================================================================
# Backup PostgreSQL của EAA vào database/backups/ (trên máy host, qua volume
# /backup trong container). Chạy định kỳ bằng Task Scheduler nếu muốn:
#   schtasks /Create /SC DAILY /ST 07:00 /TN "EAA Backup DB" ^
#     /TR "powershell -File <đường-dẫn>\scripts\backup-postgres.ps1"
#
# Phục hồi (khi cần):
#   docker exec -i enterprise_ai_postgres psql -U postgres -d enterprise_ai_demo < <file.sql>
#   (hoặc copy file vào container rồi: cat /backup/<file> | psql ...)
# ============================================================================
$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Đổi về thư mục gốc dự án (cha của scripts/) để đường dẫn tương đối luôn đúng
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

New-Item -ItemType Directory -Force -Path "database\backups" | Out-Null

$backupName = "enterprise_ai_demo_$stamp.sql"
docker exec enterprise_ai_postgres sh -c "pg_dump -U postgres -d enterprise_ai_demo -f /backup/$backupName"

if ($LASTEXITCODE -eq 0) {
  $size = (Get-Item "database\backups\$backupName").Length / 1KB
  Write-Host "Backup thành công: database\backups\$backupName ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
  Write-Host "Gợi ý: giữ lại ~10 bản gần nhất, xóa các bản cũ để tiết kiệm chỗ."
} else {
  Write-Host "Backup THẤT BẠI — kiểm tra container enterprise_ai_postgres đang chạy chưa." -ForegroundColor Red
  exit 1
}
