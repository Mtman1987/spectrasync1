#!/usr/bin/env pwsh

$secrets = @(
    "NEXT_PUBLIC_BASE_URL",
    "BOT_SECRET_KEY", 
    "DISCORD_BOT_TOKEN",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "TWITCH_CLIENT_ID",
    "TWITCH_CLIENT_SECRET",
    "FREE_CONVERT_API_KEY",
    "GEMINI_API_KEY"
)

Write-Host "Granting access to secrets for spacemtn backend..." -ForegroundColor Green

foreach ($secret in $secrets) {
    Write-Host "Granting access to: $secret" -ForegroundColor Cyan
    firebase apphosting:secrets:grantaccess $secret --backend=spacemtn
}

Write-Host "Access granted to all secrets!" -ForegroundColor Green