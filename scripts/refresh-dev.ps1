#!/usr/bin/env pwsh

Write-Host "Stopping processes on port 9002..." -ForegroundColor Yellow

# Kill processes using port 9002
$port9002 = netstat -ano | findstr ":9002"
if ($port9002) {
    $pids = $port9002 | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    foreach ($pid in $pids) {
        if ($pid -and $pid -ne "0") {
            try {
                Stop-Process -Id $pid -Force
                Write-Host "Killed process $pid on port 9002" -ForegroundColor Green
            } catch {
                Write-Host "Could not kill process $pid" -ForegroundColor Red
            }
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "No processes found on port 9002" -ForegroundColor Green
}

# Kill ngrok processes
Write-Host "Stopping ngrok..." -ForegroundColor Yellow
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Double-check port 9002 is clear
Write-Host "Verifying port 9002 is clear..." -ForegroundColor Yellow
$stillRunning = netstat -ano | findstr ":9002"
if ($stillRunning) {
    Write-Host "Port 9002 still in use, force killing remaining processes" -ForegroundColor Red
    $pids = $stillRunning | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    foreach ($pid in $pids) {
        if ($pid -and $pid -ne "0") {
            try {
                Stop-Process -Id $pid -Force
                Write-Host "Force killed process $pid" -ForegroundColor Green
            } catch {
                Write-Host "Failed to kill process $pid" -ForegroundColor Red
            }
        }
    }
    Start-Sleep -Seconds 3
} else {
    Write-Host "Port 9002 is clear" -ForegroundColor Green
}

# Wait a moment for cleanup
Start-Sleep -Seconds 2

Write-Host "Starting dev server with tunnel..." -ForegroundColor Green
npm run dev:with-tunnel