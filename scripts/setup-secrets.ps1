#!/usr/bin/env pwsh

$envPath = ".\.env"
if (-not (Test-Path $envPath)) {
    Write-Error ".env file not found"
    exit 1
}

Write-Host "Setting up Firebase App Hosting secrets..." -ForegroundColor Green

# Read all environment variables
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

# Create secrets for each environment variable
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    Write-Host "Creating secret: $key" -ForegroundColor Cyan
    
    try {
        # Create the secret
        echo $value | firebase apphosting:secrets:set $key --data-file=-
        
        # Grant access to the secret
        firebase apphosting:secrets:grantaccess $key
        
        Write-Host "Success: $key created and access granted" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to create secret $key"
    }
}

Write-Host "All secrets setup complete!" -ForegroundColor Green