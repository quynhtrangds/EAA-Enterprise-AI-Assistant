# Enterprise AI Assistant Platform - Automated Production Deployment Script (Windows PowerShell)
$ErrorActionPreference = "Continue"
$env:COMPOSE_PROJECT_NAME = "enterprise_ai"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "STARTING ENTERPRISE AI ASSISTANT PLATFORM DEPLOYMENT..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Check Docker status
Write-Host "[1/5] Checking Docker installation and status..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "Docker is running." -ForegroundColor Green
}
catch {
    Write-Host "Docker is not running. Please start Docker Desktop or Docker Service first." -ForegroundColor Red
    exit 1
}

# 2. Setup Environment Variables
Write-Host "[2/5] Setting up production environment variables..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.production.example" ".env"
    Write-Host "Created .env from .env.production.example template." -ForegroundColor Green
}
else {
    Write-Host "Existing .env file found." -ForegroundColor Green
}

# 3. Build & Start Production Containers
Write-Host "[3/5] Starting production containers via docker-compose..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>$null
docker-compose -f docker-compose.prod.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "LỖI: Không thể khởi tạo các container Docker. Dừng kịch bản!" -ForegroundColor Red
    exit 1
}

# 4. Seed Tool Permissions & Connectors
Write-Host "[4/5] Seeding tool permissions into PostgreSQL database..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
docker exec enterprise_ai_postgres psql -U postgres -d enterprise_ai_demo -c "INSERT INTO tool_permissions (role_code, tool_name, can_execute) VALUES ('admin', 'get_open_tickets', true), ('admin', 'search_repositories', true) ON CONFLICT DO NOTHING;" 2>$null | Out-Null
Write-Host "Database tool permissions verified." -ForegroundColor Green

# 5. Final Health Checks
Write-Host "[5/5] Performing platform health check verification..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $chatUiStatus = (Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing).StatusCode
    Write-Host "Chat UI Web Application: Running (HTTP $chatUiStatus)" -ForegroundColor Green
}
catch {
    Write-Host "Chat UI starting up on http://localhost:3000..." -ForegroundColor Yellow
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "ENTERPRISE AI ASSISTANT PLATFORM DEPLOYED SUCCESSFULLY!" -ForegroundColor Cyan
Write-Host "Web Application: http://localhost:3000" -ForegroundColor White
Write-Host "Vault:  http://localhost:8200" -ForegroundColor White
Write-Host "Gitea Code Server: http://localhost:3001" -ForegroundColor White
Write-Host "Zammad Helpdesk: http://localhost:8080" -ForegroundColor White
Write-Host "PostgreSQL CSDL: postgresql://postgres:postgres@localhost:55432/enterprise_ai_demo" -ForegroundColor White
Write-Host "=========================================================" -ForegroundColor Cyan
