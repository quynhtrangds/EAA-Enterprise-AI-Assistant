# ==============================================================================
# Enterprise AI Assistant - Automated PostgreSQL Database Backup Script (PowerShell)
# ==============================================================================
# Usage: .\scripts\backup-db.ps1 [-BackupDir ./backups] [-RetentionDays 30]
# ==============================================================================

param(
    [string]$BackupDir = "./backups",
    [string]$ContainerName = "enterprise_ai_postgres",
    [string]$PostgresDb = "enterprise_ai_demo",
    [string]$PostgresUser = "postgres",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "eaa_backup_${PostgresDb}_${Timestamp}.sql"
$CompressedFile = "${BackupFile}.gz"

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting database backup for '$PostgresDb'..." -ForegroundColor Cyan

try {
    docker exec -i $ContainerName pg_dump -U $PostgresUser $PostgresDb > $BackupFile

    # Compress sql dump
    if (Get-Command gzip -ErrorAction SilentlyContinue) {
        gzip -f $BackupFile
    } else {
        Compress-Archive -Path $BackupFile -DestinationPath "${BackupFile}.zip" -Force
        Remove-Item $BackupFile -Force
        $CompressedFile = "${BackupFile}.zip"
    }

    $FileItem = Get-Item $CompressedFile
    $FileSizeMB = [math]::Round($FileItem.Length / 1MB, 2)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ✅ Backup created successfully: $CompressedFile (${FileSizeMB} MB)" -ForegroundColor Green
} catch {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ❌ ERROR: Database backup failed! $_" -ForegroundColor Red
    exit 1
}

# Cleanup backups older than retention days
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "eaa_backup_*" | Where-Object { $_.LastWriteTime -lt $CutoffDate } | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "Deleted expired backup: $($_.Name)" -ForegroundColor Yellow
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Backup process complete." -ForegroundColor Cyan
