# One-click local preview: prepare local D1 (Papers I–III banks), seed local
# R2 assets (listening audio + speaking prompts + PDF fonts), start Worker + Vite.
#
# What it prepares (all local; production is untouched):
#   - D1 migrations through 0020: legacy tables + unified test bank (tests,
#     question_groups, questions, shared_resources, score_conversion_bands),
#     attempts tables (users, test_attempts, test_attempt_answers,
#     attempt_reports, pdf_cache_index), voucher_test_usage, Paper III
#     schema/seed/activate (0014–0016) + prompt copy (0018–0019), and the
#     Oct 2026 Paper I bank + preset feedback hard-replace (0020; wipes local
#     Paper I attempts).
#   - R2 simulation for worker/wrangler.toml: 21 Paper II MP3s (20 clips +
#     sound-check track) + 7 Paper III speaking prompts + Recording_Start_Sound_3Sec
#     / Recording_Stop beeps + PDF fonts (required by /api/assets/audio/* and report PDF).
#     Re-run with -ReseedAssets after adding new audio keys.
#   - Vouchers + a teacher credential; every run resets voucher usage and
#     clears local attempts/reports so each voucher can sit all papers again.
#   - Secrets (worker/.dev.vars): DEEPSEEK_API_KEY, ASSEMBLYAI_API_KEY,
#     ASSEMBLYAI_WEBHOOK_SECRET (Paper III STT + grading), and ADMIN_PASSWORD
#     (admin API returns 503 without it). Local STT uses
#     Queue polling (ASSEMBLYAI_WEBHOOK_BASE unset); webhooks are production-only.
#
# Usage:
#   .\scripts\local-preview.ps1
#   .\scripts\local-preview.ps1 -SkipSeed     # keep existing local data; just start servers
#   .\scripts\local-preview.ps1 -SkipAssets   # skip the R2 asset check/upload
#   .\scripts\local-preview.ps1 -ReseedAssets # force re-upload of audio + fonts

param(
    [switch]$SkipSeed,
    [switch]$SkipAssets,
    [switch]$ReseedAssets
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$WorkerConfig = "worker/wrangler.toml"

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
$LocalUsesPerTest = 3   # attempts allowed per paper (I / II / III each)

function Ensure-Paper3DevSecrets {
    $devVarsPath = Join-Path $repoRoot "worker\.dev.vars"
    if (-not (Test-Path $devVarsPath)) {
        throw "Missing worker/.dev.vars. Create it with ASSEMBLYAI_API_KEY, DEEPSEEK_API_KEY, and ASSEMBLYAI_WEBHOOK_SECRET."
    }

    $raw = Get-Content $devVarsPath -Raw
    $hasAssembly = $raw -match '(?m)^\s*ASSEMBLYAI_API_KEY\s*=\s*\S+'
    $hasDeepseek = $raw -match '(?m)^\s*DEEPSEEK_API_KEY\s*=\s*\S+'
    $hasWebhook = $raw -match '(?m)^\s*ASSEMBLYAI_WEBHOOK_SECRET\s*=\s*\S+'

    if (-not $hasAssembly) {
        throw "worker/.dev.vars is missing ASSEMBLYAI_API_KEY (required for Paper III STT)."
    }
    if (-not $hasDeepseek) {
        throw "worker/.dev.vars is missing DEEPSEEK_API_KEY (required for Paper III grading)."
    }
    if (-not $hasWebhook) {
        $secret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
        if (-not $raw.EndsWith("`n") -and $raw.Length -gt 0) {
            Add-Content -Path $devVarsPath -Value ""
        }
        Add-Content -Path $devVarsPath -Value "ASSEMBLYAI_WEBHOOK_SECRET=$secret"
        Write-Host "Generated ASSEMBLYAI_WEBHOOK_SECRET in worker/.dev.vars." -ForegroundColor Yellow
    } else {
        Write-Host "Paper III secrets present in worker/.dev.vars." -ForegroundColor Green
    }
}

function Reset-LocalUsageAndAttempts {
    # Order matters: children first (FKs are enforced in local D1).
    $sql = @(
        "DELETE FROM pdf_cache_index;",
        "DELETE FROM attempt_reports;",
        "DELETE FROM test_attempt_answers;",
        "DELETE FROM test_attempts;",
        "DELETE FROM users;",
        "DELETE FROM voucher_test_usage;",
        "DELETE FROM submissions;",
        "DELETE FROM sessions;",
        "UPDATE vouchers SET used_at = NULL, used_by_session = NULL, use_count = 0, uses_allowed = $LocalUsesPerTest;"
    ) -join ' '
    Invoke-WranglerD1Quiet @(
        "wrangler", "d1", "execute", "edt-diagnostic",
        "--local", "-c", $WorkerConfig,
        "--command", $sql
    )
}

function Import-LocalTeacherCredential {
    $createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    Invoke-WranglerD1Quiet @(
        "wrangler", "d1", "execute", "edt-diagnostic",
        "--local", "-c", $WorkerConfig,
        "--command", "INSERT OR REPLACE INTO teacher_credentials (key, user_group, remark, created_at) VALUES ('$LocalTeacherKey', '$LocalTeacherGroup', 'Local preview teacher credential', $createdAt);"
    )
    Invoke-WranglerD1Quiet @(
        "wrangler", "d1", "execute", "edt-diagnostic",
        "--local", "-c", $WorkerConfig,
        "--command", "INSERT OR IGNORE INTO vouchers (code, user_group, uses_allowed) VALUES ('CLASS101-TEST-001', '$LocalTeacherGroup', $LocalUsesPerTest), ('CLASS101-TEST-002', '$LocalTeacherGroup', $LocalUsesPerTest), ('CLASS101-TEST-003', '$LocalTeacherGroup', $LocalUsesPerTest);"
    )
}

function Import-LocalVouchers {
    $voucherFile = Join-Path $repoRoot "Evouchers.txt"
    if (-not (Test-Path $voucherFile)) {
        Write-Host "Evouchers.txt not found. Inserting TEST-LOCAL-001..." -ForegroundColor Yellow
        Invoke-WranglerD1Quiet @(
            "wrangler", "d1", "execute", "edt-diagnostic",
            "--local", "-c", $WorkerConfig,
            "--command", "INSERT OR IGNORE INTO vouchers (code, user_group, uses_allowed) VALUES ('TEST-LOCAL-001', 'General Learner', $LocalUsesPerTest);"
        )
        return "TEST-LOCAL-001"
    }

    $codes = Get-Content $voucherFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    if (-not $codes -or $codes.Count -eq 0) {
        throw "Evouchers.txt is empty."
    }

    $values = ($codes | ForEach-Object { "('$_', 'General Learner', $LocalUsesPerTest)" }) -join ",`n"
    $sql = "INSERT OR IGNORE INTO vouchers (code, user_group, uses_allowed) VALUES`n$values;"
    $seedFile = Join-Path $repoRoot "seed-vouchers.sql"
    $sql | Set-Content -Path $seedFile -Encoding utf8 -NoNewline

    try {
        Invoke-WranglerD1Quiet @(
            "wrangler", "d1", "execute", "edt-diagnostic",
            "--local", "-c", $WorkerConfig,
            "--file=$seedFile"
        )
    } finally {
        if (Test-Path $seedFile) {
            Remove-Item $seedFile -Force
        }
    }

    return [string]$codes[0]
}

function Test-LocalR2Assets {
    # Probe Paper II + Paper III audio (incl. start/stop beeps) and one PDF font.
    # Missing keys make wrangler write to stderr; do not treat that as fatal.
    $probeDir = Join-Path $env:TEMP "edt-r2-probe"
    New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
    $probes = @(
        "audio/test-02/20260701_00_Testing_volume.mp3",
        "audio/test-02/20260701_01.mp3",
        "audio/test-03/Speaking_Prompt_Task_1.mp3",
        "audio/test-03/Recording_Start_Sound_3Sec.mp3",
        "audio/test-03/Recording_Stop_Sound.mp3",
        "fonts/Montserrat-Regular.ttf"
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        foreach ($key in $probes) {
            $outFile = Join-Path $probeDir ([IO.Path]::GetFileName($key))
            $null = & (Get-NpxInvoker) wrangler r2 object get "edt-assets/$key" --local -c $WorkerConfig --file "$outFile" 2>&1 | Out-Null
            $found = ($LASTEXITCODE -eq 0) -and (Test-Path $outFile) -and ((Get-Item $outFile).Length -gt 0)
            Remove-Item $outFile -Force -ErrorAction SilentlyContinue
            if (-not $found) {
                Write-Host "  Missing local R2 object: $key" -ForegroundColor DarkYellow
                return $false
            }
        }
        return $true
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

# ADMIN_PASSWORD is a secret: never hardcode it here. Read the local value from
# worker/.dev.vars at runtime so the banner stays useful without a literal in git.
function Get-AdminPasswordHint {
    $devVarsPath = Join-Path $repoRoot "worker\.dev.vars"
    if (Test-Path $devVarsPath) {
        $line = Get-Content $devVarsPath | Where-Object { $_ -match '^\s*ADMIN_PASSWORD\s*=\s*\S' } | Select-Object -First 1
        if ($line) {
            $value = ($line -replace '^\s*ADMIN_PASSWORD\s*=\s*', '').Trim().Trim('"').Trim("'")
            if ($value) {
                return "password: $value"
            }
        }
    }
    return "ADMIN_PASSWORD missing from worker/.dev.vars - admin API returns 503"
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

Write-Step "Checking Paper III secrets in worker/.dev.vars..."
Ensure-Paper3DevSecrets
Write-Host "Local STT uses Queue polling (AssemblyAI cannot reach localhost)." -ForegroundColor DarkGray
Write-Host "Webhooks apply only when ASSEMBLYAI_WEBHOOK_BASE is set on a public deploy." -ForegroundColor DarkGray

Write-Step "Applying local D1 migrations (schema + Papers I–III through 0020)..."
& (Get-NpxInvoker) wrangler d1 migrations apply edt-diagnostic --local -c $WorkerConfig
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

    Write-Step "Resetting local usage, sessions, and attempts..."
    Reset-LocalUsageAndAttempts
    Write-Host "Every voucher can sit Papers I–III again ($LocalUsesPerTest attempts each)." -ForegroundColor Green
} else {
    Write-Host "Skipping voucher seed and usage reset (-SkipSeed)." -ForegroundColor Yellow
}

if ($SkipAssets) {
    Write-Host "Skipping R2 asset check (-SkipAssets). Paper II/III audio and PDF download may fail if never seeded." -ForegroundColor Yellow
} else {
    Write-Step "Checking local R2 assets (Paper II + Paper III audio + PDF fonts)..."
    if (-not $ReseedAssets -and (Test-LocalR2Assets)) {
        Write-Host "Local R2 assets already present." -ForegroundColor Green
    } else {
        Write-Host "Seeding local R2 (Paper II + Paper III MP3s + fonts; first run may download fonts)..." -ForegroundColor Yellow
        & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "upload-assets.ps1") -Local -Config $WorkerConfig
        # Exit 2 = duplicate masters only (content defect). The environment is still
        # usable, so warn loudly and continue; anything else is a real failure.
        if ($LASTEXITCODE -eq 2) {
            Write-Host ""
            Write-Warning "Some audio prompts were NOT seeded: the client's masters are byte-identical for different tasks."
            Write-Host "  See the INTEGRITY CHECK FAILED block above for the affected keys." -ForegroundColor DarkYellow
            Write-Host "  Everything else is ready; those prompts will fail to play until correct masters are supplied." -ForegroundColor DarkYellow
        } elseif ($LASTEXITCODE -ne 0) {
            throw "Local R2 asset seeding failed."
        } else {
            Write-Host "Local R2 assets ready." -ForegroundColor Green
        }
    }
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
Write-Host "  Admin:   http://localhost:5173/admin  ($(Get-AdminPasswordHint))"
Write-Host "  Teacher: http://localhost:5173  (nav: For Teachers -> teacher login)"
Write-Host "  API:     http://127.0.0.1:8787"
Write-Host "  Voucher: $sampleCode  (usage reset each run; $LocalUsesPerTest attempts per paper)"
Write-Host "  Teacher: $LocalTeacherKey  (user group: $LocalTeacherGroup)"
Write-Host ""
