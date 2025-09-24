param(
    [switch]$NoTunnel,
    [string]$Domain
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$port = 9002
# default dev domain used for ngrok when tunneling
$defaultNgrokDomain = 'mtman.ngrok-free.dev'

$refreshProc = $null

# Read NEXT_PUBLIC_BASE_URL from .env if present
$envBaseUrl = $null
try {
    $envPath = Join-Path $projectRoot ".env"
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^\s*NEXT_PUBLIC_BASE_URL\s*=\s*(.+)\s*$') {
                Set-Variable -Name envBaseUrl -Scope Script -Value ($matches[1].Trim())
            }
        }
    }
} catch {}

# Decide whether to use tunnel. Default: use tunnel for local dev. If a hosted NEXT_PUBLIC_BASE_URL
# is present and NoTunnel not explicitly set, skip starting ngrok and use the hosted URL.
function Test-UseTunnel {
    param([string]$envUrl, [switch]$noTunnel)
    if ($noTunnel) { return $false }
    if (-not $envUrl) { return $true }
    if ($envUrl -match '^(https?://)?(localhost|127\.0\.0\.1)') { return $true }
    return $false
}

$useTunnel = Test-UseTunnel -envUrl $envBaseUrl -noTunnel:$NoTunnel

# Reference envBaseUrl to avoid linter 'assigned but not used' warnings (no-op)
$null = $envBaseUrl

# Allow domain override from parameter, fall back to default ngrok domain
if ($Domain) { $ngrokDomain = $Domain } else { $ngrokDomain = $defaultNgrokDomain }

function Stop-DevProcesses {
    Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name node -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path -like '*spectrasync*' } |
        Stop-Process -Force
    $connections = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            try { Stop-Process -Id $_ -Force } catch {}
        }
    }
}

function Start-VipRefreshLoop {
    if ($refreshProc -and !$refreshProc.HasExited) {
        return
    }

    Write-Host "Starting VIP refresh loop..." -ForegroundColor DarkCyan
    $refreshProc = Start-Process -FilePath cmd.exe `
        -ArgumentList '/c','npm','run','refresh:vip' `
        -PassThru `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden
}

function Stop-VipRefreshLoop {
    if ($refreshProc -and !$refreshProc.HasExited) {
        try { $refreshProc.CloseMainWindow() } catch {}
        Start-Sleep -Milliseconds 200
        try { $refreshProc | Stop-Process -Force } catch {}
    }
    $refreshProc = $null
}

function Start-NpmDev {
    & cmd.exe /c "npm run dev"
}

while ($true) {
    Stop-DevProcesses
    Write-Host "Starting dev environment..." -ForegroundColor Cyan
    $ngrokProc = $null
    if ($useTunnel) {
        Write-Host "Starting ngrok tunnel for domain $ngrokDomain -> localhost:$port" -ForegroundColor DarkCyan
        $ngrokProc = Start-Process -FilePath ngrok -ArgumentList @('http', $port, '--domain', $ngrokDomain) -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 3
    } else {
        Write-Host "Skipping ngrok tunnel (using NEXT_PUBLIC_BASE_URL = $envBaseUrl)" -ForegroundColor DarkYellow
    }

    Start-VipRefreshLoop

    try {
        Start-NpmDev
    }
    finally {
        Stop-VipRefreshLoop
        if ($ngrokProc -and !$ngrokProc.HasExited) {
            try { $ngrokProc | Stop-Process -Force } catch {}
        }
        Stop-DevProcesses
    }

    while ($true) {
        $choice = Read-Host "Dev server stopped. Press Enter to restart or type Q to quit"
        if ([string]::IsNullOrWhiteSpace($choice)) {
            break
        }
        if ($choice -match '^(?i)npm\s+run\s+dev(:with-tunnel)?$' -or $choice -match '^(?i)(restart|reload|r)$') {
            break
        }
        if ($choice -match '^(?i)(q|quit|exit)$') {
            break 2
        }
        Write-Host "Unrecognized input. Press Enter to restart or type Q to quit." -ForegroundColor Yellow
    }
}
