# ==============================================================================
# Enterprise AI Assistant - PostgreSQL Database Restore Script (PowerShell)
# ==============================================================================
# Usage: .\scripts\restore-db.ps1 -BackupFile <path_to_backup_file>
# Example: .\scripts\restore-db.ps1 -BackupFile ./backups/eaa_backup_enterprise_ai_demo_20260810_120000.sql.gz
# ==============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "enterprise_ai_postgres",
    [string]$PostgresDb = "enterprise_ai_demo",
    [string]$PostgresUser = "postgres"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Host "Error: Backup file '$BackupFile' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Restoring database '$PostgresDb' from '$BackupFile'..." -ForegroundColor Cyan

try {
    if ($BackupFile.EndsWith(".gz")) {
        if (Get-Command gzip -ErrorAction SilentlyContinue) {
            gzip -dc $BackupFile | docker exec -i $ContainerName psql -U $PostgresUser -d $PostgresDb
        } else {
            Write-Host "Extracting .gz file..." -ForegroundColor Yellow
            $TempSql = [System.IO.Path]::GetTempFileName() + ".sql"
            $InStream = [System.IO.File]::OpenRead((Resolve-Path $BackupFile))
            $GzipStream = New-Object System.IO.Compression.GZipStream($InStream, [System.IO.Compression.CompressionMode]::Decompress)
            $OutStream = [System.IO.File]::Create($TempSql)
            $GzipStream.CopyTo($OutStream)
            $OutStream.Close()
            $GzipStream.Close()
            $InStream.Close()

            Get-Content $TempSql | docker exec -i $ContainerName psql -U $PostgresUser -d $PostgresDb
            Remove-Item $TempSql -Force
        }
    } else {
        Get-Content $BackupFile | docker exec -i $ContainerName psql -U $PostgresUser -d $PostgresDb
    }

    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ✅ Database restore completed successfully." -ForegroundColor Green
} catch {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ❌ ERROR: Database restore failed! $_" -ForegroundColor Red
    exit 1
}
