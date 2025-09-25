#!/usr/bin/env pwsh
param(
    [string]$EnvPath = ".\.env",
    [switch]$SetSecrets,
    [switch]$Deploy
)

Write-Host "Firebase App Hosting Deployment Script" -ForegroundColor Green

# Check if Firebase CLI is installed
try {
    $firebaseVersion = firebase --version
    Write-Host "Firebase CLI version: $firebaseVersion" -ForegroundColor Blue
} catch {
    Write-Error "Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
}

# Set secrets from .env file if requested
if ($SetSecrets -and (Test-Path $EnvPath)) {
    Write-Host "Setting Firebase secrets from $EnvPath..." -ForegroundColor Yellow
    
    Get-Content $EnvPath | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            # Remove quotes if present
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            
            Write-Host "Setting secret: $key" -ForegroundColor Cyan
            echo $value | firebase apphosting:secrets:set $key --data-file=-
        }
    }
}

# Deploy to Firebase App Hosting
if ($Deploy) {
    Write-Host "Deploying to Firebase App Hosting..." -ForegroundColor Yellow
    firebase deploy --only apphosting
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deployment successful!" -ForegroundColor Green
    } else {
        Write-Error "Deployment failed!"
        exit 1
    }
}

if (-not $SetSecrets -and -not $Deploy) {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\scripts\deploy-firebase.ps1 -SetSecrets    # Set secrets from .env"
    Write-Host "  .\scripts\deploy-firebase.ps1 -Deploy       # Deploy to Firebase"
    Write-Host "  .\scripts\deploy-firebase.ps1 -SetSecrets -Deploy  # Both"
}