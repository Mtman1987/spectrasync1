<#
Upload .env values to the app_settings/runtime Firestore doc via the admin API.

Usage:
  # From repo root
  .\scripts\upload-env.ps1 -EnvPath .\.env -Url https://spcmtn--cosmic-raid-app.us-central1.hosted.app -Secret <BOT_SECRET_KEY>

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
        $k = $matches[1].Trim()
        $v = $matches[2].Trim()
        # Remove surrounding single or double quotes if present
        if ($v.Length -ge 2) {
            $first = $v.Substring(0,1)
            $last = $v.Substring($v.Length - 1, 1)
            if ((($first -eq '"') -and ($last -eq '"')) -or (($first -eq "'") -and ($last -eq "'"))) {
                $v = $v.Substring(1, $v.Length - 2)
            }
        }
    # Coerce booleans only; keep numeric IDs as strings to avoid overflow issues
    if ($v -match '^(true|false)$') { $val = $v -eq 'true' }
    else { $val = $v }
        $pairs[$k] = $val
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
