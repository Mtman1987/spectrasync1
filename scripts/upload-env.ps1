<#
Upload .env values to the app_settings/runtime Firestore doc via the admin API.

Usage:
  # From repo root
    .\scripts\upload-env.ps1 -EnvPath .\.env -Url https://spacemtn--cosmic-raid-app.us-central1.hosted.app -Secret <BOT_SECRET_KEY>

If -Secret is omitted the script will try to read BOT_SECRET_KEY from the current environment.
#>

param(
    [string]$EnvPath = ".env",
    [string]$Url = $env:NEXT_PUBLIC_BASE_URL,
    [string]$Secret
)

if (-not $Secret) { $Secret = $env:BOT_SECRET_KEY }

if (-not (Test-Path $EnvPath)) {
    Write-Error "Env file not found at $EnvPath"
    exit 1
}

if (-not $Url) {
    Write-Host "NEXT_PUBLIC_BASE_URL not provided; please specify -Url or set NEXT_PUBLIC_BASE_URL in environment." -ForegroundColor Yellow
    exit 1
}

if (-not $Secret) {
    Write-Host "BOT_SECRET_KEY not provided; please specify -Secret or set BOT_SECRET_KEY in environment." -ForegroundColor Yellow
    exit 1
}

Write-Host "Reading env from $EnvPath..."

$pairs = @{}
Get-Content $EnvPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }

    if ($line -match "^([^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()

        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if ((($first -eq '"') -and ($last -eq '"')) -or (($first -eq "'") -and ($last -eq "'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        # Coerce booleans only; keep numeric IDs as strings to avoid overflow issues
        $coerced = if ($value -match '^(true|false)$') {
            $value -eq 'true'
        } else {
            $value
        }

        $pairs[$key] = $coerced
    }
}

if ($pairs.Count -eq 0) {
    Write-Host "No env variables found to upload." -ForegroundColor Yellow
    exit 0
}

$payload = @{ root = $pairs } | ConvertTo-Json -Depth 5

$endpoint = $Url.TrimEnd('/') + "/api/admin/env"

Write-Host "Uploading ${($pairs.Count)} keys to $endpoint"

$headers = @{ 'x-bot-secret' = $Secret; 'Content-Type' = 'application/json' }

$response = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $payload -ErrorAction Stop

Write-Host "Response:" -ForegroundColor Green
Write-Host (ConvertTo-Json $response -Depth 5)
