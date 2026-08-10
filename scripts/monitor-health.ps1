# ==============================================================================
# Enterprise AI Assistant - Proactive Service Health Monitoring & Alert Script (PowerShell)
# ==============================================================================
# Usage: .\scripts\monitor-health.ps1 [-WebhookUrl "https://hooks.slack.com/..."]
# ==============================================================================

param(
    [string]$WebhookUrl = $env:WEBHOOK_URL,
    [string]$OrchestratorUrl = "http://localhost:8082/health",
    [string]$GatewayUrl = "http://localhost:8081/health",
    [string]$ChatUiUrl = "http://localhost:3000"
)

$FailedServices = @()

function Check-ServiceEndpoint {
    param(
        [string]$Name,
        [string]$Url
    )
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Checking $Name ($Url)... " -NoNewline

    try {
        $Response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($Response.StatusCode -eq 200) {
            Write-Host "OK (200)" -ForegroundColor Green
        } else {
            Write-Host "FAILED (HTTP $($Response.StatusCode))" -ForegroundColor Red
            $script:FailedServices += "$Name (HTTP $($Response.StatusCode))"
        }
    } catch {
        Write-Host "UNREACHABLE ($_)" -ForegroundColor Red
        $script:FailedServices += "$Name (Unreachable)"
    }
}

Check-ServiceEndpoint -Name "MCP Gateway" -Url $GatewayUrl
Check-ServiceEndpoint -Name "AI Orchestrator" -Url $OrchestratorUrl
Check-ServiceEndpoint -Name "Chat UI" -Url $ChatUiUrl

if ($FailedServices.Count -gt 0) {
    $AlertText = "⚠️ [ALERT] Enterprise AI Assistant service failure!`nFailed services:`n" + ($FailedServices -join "`n")
    Write-Host "`n$AlertText" -ForegroundColor Red

    if ($WebhookUrl) {
        $Body = @{ text = $AlertText } | ConvertTo-Json
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $Body -ContentType "application/json" -ErrorAction SilentlyContinue
    }
    exit 1
} else {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] All services healthy." -ForegroundColor Green
    exit 0
}
