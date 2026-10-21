# Migrate + cleanse the REMOTE Cloudflare D1 database (edt-diagnostic).
#
# What it does, in order:
#   1. Exports a full backup to db_backup/edt-diagnostic-<timestamp>.sql
#   2. Applies pending migrations (through 0021: unified test bank, Papers I–III
#      content, voucher_test_usage, AI feedback, Paper III schema/seed/activate,
#      Oct 2026 Paper I bank + feedback_items hard-replace, then 0021 feedback
#      italics/links, which is non-destructive). Migration 0020
#      DELETES live Paper I attempts, answers, reports, PDF cache rows, class
#      overviews, and submissions even with -SkipCleanse, and drops
#      attempt_reports.ai_feedback_zh. Backup first.
#   3. Cleanses candidate data: deletes submissions, sessions, attempts,
#      reports, PDF cache index, users, and per-test usage; resets every
#      voucher to unused. VOUCHERS AND TEACHER CREDENTIALS ARE KEPT.
#      Prefer -SkipCleanse for additive go-live that must keep Papers II/III
#      attempts. It will NOT preserve Paper I history once 0020 applies.
#   4. Verifies row counts (3 tests, 145 groups, 2695 questions, 1869 Paper I
#      feedback items, 38 conversion bands after 0020; vouchers intact)
#
# Usage:
#   .\scripts\migrate-remote-db.ps1
#   .\scripts\migrate-remote-db.ps1 -Force        # skip confirmation prompt
#   .\scripts\migrate-remote-db.ps1 -SkipBackup   # no export first (not recommended)
#   .\scripts\migrate-remote-db.ps1 -SkipCleanse  # only backup + migrations
#
# Requires: wrangler auth with D1 access (npx wrangler login, once per machine).

param(
    [switch]$Force,
    [switch]$SkipBackup,
    [switch]$SkipCleanse
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$db = 'edt-diagnostic'

function Write-Step([string]$text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Get-NpxInvoker() {
    if ($IsWindows -or $env:OS -match "Windows") { return "npx.cmd" }
    return "npx"
}

# Runs wrangler with stderr merged and $ErrorActionPreference relaxed so
# wrangler's stderr output cannot become a terminating NativeCommandError
# under Windows PowerShell 5.1. Prints output; returns the exit code.
function Invoke-Wrangler([string[]]$WranglerArgs) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & (Get-NpxInvoker) wrangler @WranglerArgs 2>&1 | ForEach-Object { Write-Host "  $_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    return $code
}

# Runs a remote D1 query with --json and returns the parsed `results` array.
function Invoke-D1Query([string]$sql) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $raw = & (Get-NpxInvoker) wrangler d1 execute $db --remote -c wrangler.toml --command $sql --json 2>$null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($code -ne 0) { throw "D1 query failed (exit $code): $sql" }
    $parsed = ($raw -join "`n") | ConvertFrom-Json
    return $parsed[0].results
}

function Invoke-D1Command([string]$sql) {
    $code = Invoke-Wrangler @('d1', 'execute', $db, '--remote', '-c', 'wrangler.toml', '--command', $sql)
    if ($code -ne 0) { throw "D1 command failed (exit $code): $sql" }
}

Write-Step "Remote D1 migrate + cleanse ($db)"
Write-Host "This will:"
if (-not $SkipBackup) {
    Write-Host "  - Export a full backup to db_backup/ first"
}
Write-Host "  - Apply all pending migrations (unified test bank)"
if (-not $SkipCleanse) {
    Write-Host "  - DELETE submissions, sessions, attempts, reports, users, per-test usage"
    Write-Host "  - RESET all vouchers to unused (use_count=0)"
    Write-Host ""
    Write-Host "Vouchers and teacher credentials are KEPT." -ForegroundColor Yellow
}

if (-not $Force) {
    $answer = Read-Host "Type MIGRATE to continue"
    if ($answer -ne "MIGRATE") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

# --- 1. Backup ---
if (-not $SkipBackup) {
    Write-Step "Exporting backup..."
    New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot 'db_backup') | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupFile = "db_backup/$db-$stamp.sql"
    $code = Invoke-Wrangler @('d1', 'export', $db, '--remote', '-c', 'wrangler.toml', '--output', $backupFile)
    if ($code -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
        throw "Backup export failed; aborting before any change."
    }
    Write-Host "Backup written: $backupFile ($([math]::Round((Get-Item $backupFile).Length / 1KB)) KB)" -ForegroundColor Green
} else {
    Write-Host "Skipping backup (-SkipBackup)." -ForegroundColor Yellow
}

# --- 2. Migrations ---
Write-Step "Applying pending migrations..."
$code = Invoke-Wrangler @('d1', 'migrations', 'apply', $db, '--remote', '-c', 'wrangler.toml')
if ($code -ne 0) { throw "Migrations apply failed (exit $code)." }

# --- 3. Cleanse ---
if (-not $SkipCleanse) {
    Write-Step "Cleansing candidate data (vouchers + teacher credentials kept)..."
    # Child tables first, then their parents.
    $statements = @(
        "DELETE FROM pdf_cache_index;",
        "DELETE FROM attempt_reports;",
        "DELETE FROM test_attempt_answers;",
        "DELETE FROM test_attempts;",
        "DELETE FROM users;",
        "DELETE FROM voucher_test_usage;",
        "DELETE FROM submissions;",
        "DELETE FROM sessions;",
        "UPDATE vouchers SET used_at = NULL, used_by_session = NULL, use_count = 0;"
    )
    Invoke-D1Command ($statements -join ' ')
} else {
    Write-Host "Skipping cleanse (-SkipCleanse)." -ForegroundColor Yellow
}

# --- 4. Verify ---
Write-Step "Verifying..."
# Single line: newlines inside the --command argument break npx.cmd on Windows.
$verifySql = "SELECT (SELECT COUNT(*) FROM tests) AS tests, (SELECT COUNT(*) FROM question_groups) AS question_groups, (SELECT COUNT(*) FROM questions) AS questions, (SELECT COUNT(*) FROM feedback_items) AS feedback_items, (SELECT COUNT(*) FROM score_conversion_bands) AS bands, (SELECT COUNT(*) FROM vouchers) AS vouchers, (SELECT COUNT(*) FROM teacher_credentials) AS teacher_credentials, (SELECT COUNT(*) FROM submissions) AS submissions, (SELECT COUNT(*) FROM test_attempts) AS test_attempts, (SELECT COUNT(*) FROM vouchers WHERE use_count > 0 OR used_at IS NOT NULL) AS used_vouchers;"
$checks = Invoke-D1Query $verifySql
$row = $checks[0]

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Remote migrate + cleanse complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  tests:               $($row.tests)  (expected 3)"
Write-Host "  question groups:     $($row.question_groups)  (expected 145)"
Write-Host "  questions:           $($row.questions)  (expected 2695 after 0020)"
Write-Host "  feedback items:      $($row.feedback_items)  (expected 1869 after 0020)"
Write-Host "  conversion bands:    $($row.bands)  (expected 38 after 0020)"
Write-Host "  vouchers (kept):     $($row.vouchers)"
Write-Host "  teacher credentials: $($row.teacher_credentials)"
Write-Host "  submissions:         $($row.submissions)  (expected 0 after cleanse)"
Write-Host "  test attempts:       $($row.test_attempts)  (expected 0 after cleanse)"
Write-Host "  used vouchers:       $($row.used_vouchers)  (expected 0 after cleanse)"

if ([int]$row.tests -lt 3 -or [int]$row.questions -ne 2695 -or [int]$row.question_groups -ne 145 -or [int]$row.feedback_items -ne 1869 -or [int]$row.bands -ne 38) {
    Write-Warning "Counts differ from the expected test bank (3 tests / 145 groups / 2695 questions / 1869 feedback items / 38 bands). Check migration output above."
}

Write-Host ""
Write-Host "Production: https://eng-diagnostic.tzy667.workers.dev"
