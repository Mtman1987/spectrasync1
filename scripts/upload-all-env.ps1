#!/usr/bin/env pwsh
param(
    [string]$Url = "https://spacemtn--cosmic-raid-app.us-central1.hosted.app"
)

$envPath = ".\.env"
if (-not (Test-Path $envPath)) {
    Write-Error ".env file not found"
    exit 1
}

$envVars = @{}
$botSecret = ""
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'
        $envVars[$key] = $value
        if ($key -eq "BOT_SECRET_KEY") { $botSecret = $value }
    }
}

if (-not $botSecret) {
    Write-Error "BOT_SECRET_KEY not found in .env file"
    exit 1
}

$payload = @{ root = $envVars } | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$Url/api/admin/env" -Method POST -Headers @{
        "Content-Type" = "application/json"
        "x-bot-secret" = $botSecret
    } -Body $payload
    
    Write-Host "Environment variables uploaded successfully!" -ForegroundColor Green
} catch {
    Write-Error "Upload failed: $_"
}