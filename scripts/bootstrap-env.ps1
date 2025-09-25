#!/usr/bin/env pwsh
param(
    [string]$Url = "https://spacemtn--cosmic-raid-app.us-central1.hosted.app"
)

# First set BOT_SECRET_KEY directly in Firestore
$botSecret = "1234"
$payload = @{ BOT_SECRET_KEY = $botSecret } | ConvertTo-Json

try {
    # Use Firebase Admin SDK to set initial secret
    Write-Host "Setting initial BOT_SECRET_KEY..." -ForegroundColor Yellow
    
    # Then upload all env vars
    $envPath = ".\.env"
    $envVars = @{}
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            $envVars[$key] = $value
        }
    }

    $fullPayload = @{ root = $envVars } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod -Uri "$Url/api/admin/env" -Method POST -Headers @{
        "Content-Type" = "application/json"
        "x-bot-secret" = $botSecret
    } -Body $fullPayload
    
    Write-Host "All environment variables uploaded!" -ForegroundColor Green
    Write-Host "Variables uploaded: $($envVars.Keys -join ', ')" -ForegroundColor Cyan
} catch {
    Write-Error "Bootstrap failed: $_"
}