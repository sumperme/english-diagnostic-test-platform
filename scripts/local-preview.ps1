# One-click local preview: prepare local D1, start Worker + Vite, open browser.
#
# Usage:
#   .\scripts\local-preview.ps1
#   .\scripts\local-preview.ps1 -SkipSeed

param(
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Write-Step([string]$text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Get-NpxInvoker() {
    if ($IsWindows -or $env:OS -match "Windows") {
        return "npx.cmd"
    }
    return "npx"
}

function Invoke-WranglerD1Quiet([string[]]$WranglerArgs) {
    $null = & (Get-NpxInvoker) @WranglerArgs 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "wrangler d1 command failed (exit $LASTEXITCODE)."
    }
}

$LocalTeacherKey = "TEACHER-LOCAL-001"
$LocalTeacherGroup = "Class-ENG101"

function Reset-LocalVoucherUsage {
    Invoke-WranglerD1Quiet @(
        "wrangler", "d1", "execute", "edt-diagnostic",
        "--local", "-c", "worker/wrangler.toml",
        "--command", "DELETE FROM submissions; DELETE FROM sessions; UPDATE vouchers SET used_at = NULL, used_by_session = NULL;"
    )
}

function Import-LocalTeacherCredential {
    $createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    Invoke-WranglerD1Quiet @(
        "wrangler", "d1", "execute", "edt-diagnostic",
        "--local", "-c", "worker/wrangler.toml",
        "--command", "INSERT OR REPLACE INTO teacher_credentials (key, user_group, remark, created_at) VALUES ('$LocalTeacherKey', '$LocalTeacherGroup', 'Local preview teacher credential', $createdAt);"
    )
    Invoke-WranglerD1Quiet @(
        "wrangler", "d1", "execute", "edt-diagnostic",
        "--local", "-c", "worker/wrangler.toml",
        "--command", "INSERT OR IGNORE INTO vouchers (code, user_group) VALUES ('CLASS101-TEST-001', '$LocalTeacherGroup'), ('CLASS101-TEST-002', '$LocalTeacherGroup'), ('CLASS101-TEST-003', '$LocalTeacherGroup');"
    )
}

function Import-LocalVouchers {
    $voucherFile = Join-Path $repoRoot "Evouchers.txt"
    if (-not (Test-Path $voucherFile)) {
        Write-Host "Evouchers.txt not found. Inserting TEST-LOCAL-001..." -ForegroundColor Yellow
        Invoke-WranglerD1Quiet @(
            "wrangler", "d1", "execute", "edt-diagnostic",
            "--local", "-c", "worker/wrangler.toml",
            "--command", "INSERT OR IGNORE INTO vouchers (code, user_group) VALUES ('TEST-LOCAL-001', 'General Learner');"
        )
        Reset-LocalVoucherUsage
        return "TEST-LOCAL-001"
    }

    $codes = Get-Content $voucherFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    if (-not $codes -or $codes.Count -eq 0) {
        throw "Evouchers.txt is empty."
    }

    $values = ($codes | ForEach-Object { "('$_', 'General Learner')" }) -join ",`n"
    $sql = "INSERT OR IGNORE INTO vouchers (code, user_group) VALUES`n$values;"
    $seedFile = Join-Path $repoRoot "seed-vouchers.sql"
    $sql | Set-Content -Path $seedFile -Encoding utf8 -NoNewline

    try {
        Invoke-WranglerD1Quiet @(
            "wrangler", "d1", "execute", "edt-diagnostic",
            "--local", "-c", "worker/wrangler.toml",
            "--file=$seedFile"
        )
    } finally {
        if (Test-Path $seedFile) {
            Remove-Item $seedFile -Force
        }
    }

    Reset-LocalVoucherUsage
    return [string]$codes[0]
}

function Wait-ForWorker([string]$url, [int]$maxSeconds = 45) {
    for ($i = 0; $i -lt $maxSeconds; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

Write-Step "Project: $repoRoot"

Write-Step "Applying local D1 migrations..."
& (Get-NpxInvoker) wrangler d1 migrations apply edt-diagnostic --local -c worker/wrangler.toml
if ($LASTEXITCODE -ne 0) {
    throw "Local D1 migration failed."
}

$sampleCode = "TEST-LOCAL-001"
if (-not $SkipSeed) {
    Write-Step "Seeding local vouchers..."
    $sampleCode = Import-LocalVouchers
    Write-Host "Local vouchers ready." -ForegroundColor Green

    Write-Step "Seeding local teacher credential..."
    Import-LocalTeacherCredential
    Write-Host "Local teacher credential ready." -ForegroundColor Green
} else {
    Write-Host "Skipping voucher seed (-SkipSeed)." -ForegroundColor Yellow
}

Write-Step "Starting local Worker (new window)..."
$workerCommand = "Set-Location '$repoRoot'; npm run worker:dev"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $workerCommand

Write-Step "Waiting for Worker at http://127.0.0.1:8787/api/health ..."
if (Wait-ForWorker "http://127.0.0.1:8787/api/health") {
    Write-Host "Worker is ready." -ForegroundColor Green
} else {
    Write-Host "Worker is still starting. Vite will work once it is ready." -ForegroundColor Yellow
}

Write-Step "Starting Vite dev server (new window)..."
$viteCommand = "Set-Location '$repoRoot'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $viteCommand

Start-Sleep -Seconds 2

Write-Step "Opening browser..."
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Local preview started" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  UI:      http://localhost:5173"
Write-Host "  Admin:   http://localhost:5173/admin  (password: EDT-Aa2026!)"
Write-Host "  Schools: http://localhost:5173  (nav: For schools -> teacher login)"
Write-Host "  API:     http://127.0.0.1:8787"
Write-Host "  Voucher: $sampleCode  (unused; all local vouchers reset each run)"
Write-Host "  Teacher: $LocalTeacherKey  (user group: $LocalTeacherGroup)"
Write-Host ""
Write-Host "Note: Local D1 is separate from Cloudflare. Codes used on production still work locally."
Write-Host "Vite proxies /api/* to the local Worker."
Write-Host "Two PowerShell windows were opened (Worker + Vite)."
Write-Host "Close those windows to stop preview."
Write-Host ""
