# Chạy đồng thời Backend và Frontend để test app
# Chạy từ thư mục game-scoring: .\run-app.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }

$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

if (-not (Test-Path $backendPath)) {
    Write-Host "Không tìm thấy thư mục backend: $backendPath" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $frontendPath)) {
    Write-Host "Không tìm thấy thư mục frontend: $frontendPath" -ForegroundColor Red
    exit 1
}

Write-Host "=== Game Scoring - Start Backend & Frontend ===" -ForegroundColor Cyan
Write-Host "Backend:  $backendPath" -ForegroundColor Gray
Write-Host "Frontend: $frontendPath" -ForegroundColor Gray
Write-Host ""

# Mở Backend trong cửa sổ PowerShell mới
Write-Host "Đang khởi chạy Backend (cửa sổ mới)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendPath'; Write-Host 'Backend - Game Scoring' -ForegroundColor Green; npm run dev"
)

# Đợi backend kịp listen port
Start-Sleep -Seconds 3

# Mở Frontend trong cửa sổ PowerShell mới
Write-Host "Đang khởi chạy Frontend (cửa sổ mới)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontendPath'; Write-Host 'Frontend - Game Scoring' -ForegroundColor Green; npm run dev"
)

Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Đóng từng cửa sổ PowerShell để dừng Backend hoặc Frontend." -ForegroundColor Gray
