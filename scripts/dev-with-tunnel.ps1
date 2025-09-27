param(
    [switch]$NoTunnel,
    [string]$Domain
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$port = 9002
# default dev domain used for ngrok when tunneling
$defaultNgrokDomain = 'unostensible-carola-preallied.ngrok-free.dev'

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
    # Stop VIP refresh process first
    Stop-VipRefreshLoop
    
    # Kill all related processes
    Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name node -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path -like '*spectrasync*' } |
        Stop-Process -Force
    Get-Process -Name tsx -ErrorAction SilentlyContinue | Stop-Process -Force
    
    # Kill VIP processes by command line pattern
    try {
        $vipProcesses = Get-WmiObject Win32_Process | Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -like "*vip-live-refresh*" -or
                $_.CommandLine -like "*vip-live-runner*" -or
                ($_.CommandLine -like "*tsx*" -and $_.CommandLine -like "*spectrasync*")
            )
        }
        
        if ($vipProcesses) {
            $vipProcesses | ForEach-Object {
                try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    } catch {}
    
    # Clean up port connections
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
    
    # Also kill any remaining VIP processes by pattern
    try {
        $vipProcesses = Get-WmiObject Win32_Process | Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -like "*vip-live-refresh*" -or
                $_.CommandLine -like "*refresh:vip*" -or
                ($_.CommandLine -like "*npm*" -and $_.CommandLine -like "*refresh:vip*")
            )
        }
        
        if ($vipProcesses) {
            $vipProcesses | ForEach-Object {
                try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    } catch {}
    
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
        Write-Host "Starting ngrok tunnel for localhost:$port" -ForegroundColor DarkCyan
        # Start ngrok with specific URL
        Start-Process -FilePath "cmd" -ArgumentList "/c", "ngrok", "http", $port, "--url=https://$ngrokDomain" -WindowStyle Hidden
        Start-Sleep -Seconds 5
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
