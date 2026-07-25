# Uploads EDT assets to the R2 bucket `edt-assets`:
#   - 21 Test 2 MP3s            -> audio/test-02/
#     (20 listening clips + 20260701_00_Testing_volume.mp3 sound-check track)
#   - 7 Paper III speaking prompts + start/stop beeps -> audio/test-03/
#   - PDF report fonts          -> fonts/  (downloaded if missing)
#
# Prerequisites (remote mode):
#   1. R2 enabled on the Cloudflare account (Dashboard -> R2 -> accept terms).
#   2. Auth with R2 permission. The wrangler OAuth login (`npx wrangler login`)
#      often lacks the R2 API scope; in that case set an R2-scoped API token
#      for THIS SESSION ONLY (never commit it):
#        $env:CLOUDFLARE_API_TOKEN  = "<r2-scoped api token>"
#        $env:CLOUDFLARE_ACCOUNT_ID = "<cloudflare account id>"
#      or pass -ApiToken / -AccountId.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File ./scripts/upload-assets.ps1
#       -> remote R2 (production)
#   powershell -ExecutionPolicy Bypass -File ./scripts/upload-assets.ps1 -Local
#       -> local R2 simulation of the ROOT wrangler.toml (repo-root `wrangler dev`)
#   powershell -ExecutionPolicy Bypass -File ./scripts/upload-assets.ps1 -Local -Config worker/wrangler.toml
#       -> local R2 simulation of the WORKER config (used by `npm run worker:dev`
#          and scripts/local-preview.ps1; state lives in worker/.wrangler/state)

param(
    [switch]$Local,
    [string]$Config = "",
    [string]$ApiToken = "",
    [string]$AccountId = ""
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($ApiToken) { $env:CLOUDFLARE_API_TOKEN = $ApiToken }
if ($AccountId) { $env:CLOUDFLARE_ACCOUNT_ID = $AccountId }

$bucket = 'edt-assets'
$flags = @()
if ($Local) { $flags += '--local' } else { $flags += '--remote' }
if ($Config) { $flags += @('-c', $Config) }

function Get-NpxInvoker() {
    if ($IsWindows -or $env:OS -match "Windows") { return "npx.cmd" }
    return "npx"
}

# Runs wrangler with stderr merged into stdout and $ErrorActionPreference
# relaxed, so wrangler's stderr output cannot become a terminating
# NativeCommandError under Windows PowerShell 5.1. Returns the exit code.
function Invoke-Wrangler([string[]]$WranglerArgs) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & (Get-NpxInvoker) wrangler @WranglerArgs 2>&1 | ForEach-Object { Write-Host "  $_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    return $code
}

if (-not $Local) {
    Write-Host "Ensuring bucket '$bucket' exists (failure is OK if it already does)..."
    $createCode = Invoke-Wrangler @('r2', 'bucket', 'create', $bucket)
    if ($createCode -ne 0) {
        Write-Host "Bucket create failed or bucket already exists. Continuing with uploads." -ForegroundColor Yellow
    }
}

# --- Audio tracks ---
$audioDir = Join-Path $root 'Client_Feedback\Audio Tracks'
$tracks = Get-ChildItem -Path $audioDir -Filter '*.mp3' | Sort-Object Name
# 20 question clips + the 00 volume-testing track used by the pre-test sound check.
if ($tracks.Count -ne 21) {
    Write-Warning "Expected 21 MP3s in '$audioDir', found $($tracks.Count)."
}
foreach ($track in $tracks) {
    $key = "audio/test-02/$($track.Name)"
    Write-Host "Uploading $key"
    $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$key", '--file', $track.FullName, '--content-type', 'audio/mpeg') + $flags)
    if ($code -ne 0) { throw "Upload failed for $key" }
}

# --- Paper III speaking prompt tracks ---
# Source filenames use spaces ("Speaking Prompt_Task 1.mp3"); R2 keys use
# underscores to match shared_resources.content_url in the Test 3 seed.
$paper3AudioDir = Join-Path $root 'Client_Feedback\Audio Tracks_Paper III'
for ($n = 1; $n -le 7; $n++) {
    $srcName = "Speaking Prompt_Task $n.mp3"
    $src = Join-Path $paper3AudioDir $srcName
    if (-not (Test-Path $src)) {
        Write-Warning "Missing Paper III track: $src"
        continue
    }
    $key = "audio/test-03/Speaking_Prompt_Task_$n.mp3"
    Write-Host "Uploading $key (from $srcName)"
    $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$key", '--file', $src, '--content-type', 'audio/mpeg') + $flags)
    if ($code -ne 0) { throw "Upload failed for $key" }
}

$sfxDir = Join-Path $root 'Client_Feedback\system_sound_effects'
foreach ($sfx in @(
    # 3-second start cue (synced with on-screen 3-2-1). Source may be .MP3 casing.
    @{ File = 'Recording_Start_Sound_3Sec.MP3'; Key = 'audio/test-03/Recording_Start_Sound_3Sec.mp3' },
    @{ File = 'Recording_Stop_Sound.mp3'; Key = 'audio/test-03/Recording_Stop_Sound.mp3' }
)) {
    $src = Join-Path $sfxDir $sfx.File
    if (-not (Test-Path $src)) {
        # Fall back to lowercase extension if present.
        $alt = Join-Path $sfxDir ($sfx.File -replace '\.MP3$', '.mp3')
        if (Test-Path $alt) { $src = $alt }
    }
    if (-not (Test-Path $src)) {
        throw "Missing required Paper III system sound: $($sfx.File) in $sfxDir"
    }
    Write-Host "Uploading $($sfx.Key)"
    $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$($sfx.Key)", '--file', $src, '--content-type', 'audio/mpeg') + $flags)
    if ($code -ne 0) { throw "Upload failed for $($sfx.Key)" }
}

# --- PDF fonts ---
$fontDir = Join-Path $root '.fonts-cache'
New-Item -ItemType Directory -Force -Path $fontDir | Out-Null

$fonts = @(
    @{ Key = 'fonts/Montserrat-Regular.ttf';  Url = 'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf' },
    @{ Key = 'fonts/Montserrat-SemiBold.ttf'; Url = 'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-SemiBold.ttf' },
    # TrueType-outline variable font: fontkit can subset it at PDF render time
    # (its CFF subsetter cannot encode the Noto CJK OTFs), keeping report PDFs small.
    @{ Key = 'fonts/NotoSerifTC-Regular.ttf'; Url = 'https://github.com/google/fonts/raw/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf' }
)

foreach ($font in $fonts) {
    $file = Join-Path $fontDir (Split-Path $font.Key -Leaf)
    if (-not (Test-Path $file)) {
        Write-Host "Downloading $($font.Url)"
        Invoke-WebRequest -Uri $font.Url -OutFile $file
    }
    $contentType = if ($file.EndsWith('.otf')) { 'font/otf' } else { 'font/ttf' }
    Write-Host "Uploading $($font.Key)"
    $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$($font.Key)", '--file', $file, '--content-type', $contentType) + $flags)
    if ($code -ne 0) { throw "Upload failed for $($font.Key)" }
}

Write-Host 'Done.'
