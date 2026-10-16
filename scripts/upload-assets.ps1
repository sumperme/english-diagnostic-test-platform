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
#
# Exit codes:
#   0  Success. Missing master folders are warnings, not failures (see below).
#   1  Operational failure: wrangler/R2 rejected an upload, or a font download
#      failed. These `throw` immediately, so 1 always wins over 2 - the run
#      aborts before it can reach the integrity summary.
#   2  Integrity failure only: byte-identical masters were bound for different
#      R2 keys. The duplicate keys are skipped and everything else is uploaded,
#      so the environment stays usable. This is a defect in the CONTENT, not in
#      the environment, and callers that only need a working local environment
#      (scripts/local-preview.ps1) may treat 2 as a warning and continue.
#
# Audio masters:
#   The MP3 masters live in the gitignored `Client_Feedback/` folder (see
#   -AssetSource below). They are IRREPLACEABLE source assets: without them the
#   R2 bucket cannot be re-seeded or restored. Keep a backup outside the repo and
#   point -AssetSource at it, e.g.
#     ... -AssetSource "D:\EDT-Masters"
#   expecting these subfolders:
#     <AssetSource>\Audio Tracks            21 Paper II MP3s
#     <AssetSource>\Audio Tracks_Paper III  7 "Speaking Prompt_Task N.mp3"
#     <AssetSource>\system_sound_effects    Recording_Start_Sound_3Sec + _Stop
#   If a folder is absent the script skips that group with a warning and still
#   uploads the rest (fonts always work), so local preview stays usable.

param(
    [switch]$Local,
    [string]$Config = "",
    [string]$ApiToken = "",
    [string]$AccountId = "",
    [string]$AssetSource = ""
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($ApiToken) { $env:CLOUDFLARE_API_TOKEN = $ApiToken }
if ($AccountId) { $env:CLOUDFLARE_ACCOUNT_ID = $AccountId }

$bucket = 'edt-assets'

# Root of the audio masters. Defaults to the historical in-repo location.
$assetRoot = if ($AssetSource) { $AssetSource } else { Join-Path $root 'Client_Feedback' }
$skipped = @()
$integrityFailures = @()
$integrityWarnings = @()
$blockedKeys = @{}

function Write-MissingSource([string]$what, [string]$path, [string]$expects) {
    Write-Warning "Skipping $what - source folder not found: $path"
    Write-Host "    Needed: $expects" -ForegroundColor DarkYellow
    Write-Host "    Restore the masters there, or re-run with -AssetSource <folder containing 'Audio Tracks', 'Audio Tracks_Paper III', 'system_sound_effects'>." -ForegroundColor DarkYellow
    $script:skipped += $what
}

# Pre-upload integrity check for one audio group. $Plan is a list of
# @{ Key = '<r2 key>'; Path = '<master file>' }.
#
# Two different R2 keys fed from byte-identical masters is always a content
# defect - the Paper III Task 5 and Task 6 speaking prompts shipped that way and
# nothing downstream can detect it once the objects are in R2. Colliding keys are
# left at their previous contents and the run exits non-zero.
function Test-AudioGroupIntegrity([string]$Group, [object[]]$Plan) {
    $entries = @()
    foreach ($item in $Plan) {
        $file = Get-Item -LiteralPath $item.Path
        if ($file.Length -eq 0) {
            Write-Warning "$Group - '$($file.Name)' is 0 bytes; it would publish an empty object at $($item.Key)."
            $script:integrityWarnings += "$($item.Key) <- $($file.Name) (0 bytes)"
            continue
        }
        $entries += [pscustomobject]@{
            Key  = $item.Key
            Name = $file.Name
            Hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        }
    }

    foreach ($dupe in @($entries | Group-Object Hash | Where-Object { $_.Count -gt 1 })) {
        $distinctKeys = @($dupe.Group | ForEach-Object { $_.Key } | Sort-Object -Unique)
        # The same master legitimately feeding one key is not a collision.
        if ($distinctKeys.Count -lt 2) { continue }

        Write-Host ''
        Write-Host "DUPLICATE AUDIO - $Group" -ForegroundColor Red
        Write-Host "  SHA-256 $($dupe.Name)" -ForegroundColor Red
        Write-Host "  These masters are byte-identical but must be different recordings:" -ForegroundColor Red
        foreach ($entry in @($dupe.Group | Sort-Object Key)) {
            Write-Host "    $($entry.Name)  ->  $bucket/$($entry.Key)" -ForegroundColor Red
        }
        Write-Host "  Not uploading these keys. Re-supply the correct master, then re-run." -ForegroundColor Red
        Write-Host ''

        foreach ($entry in $dupe.Group) { $script:blockedKeys[$entry.Key] = $true }
        $script:integrityFailures += "$Group - $($distinctKeys -join '  ==  ') share SHA-256 $($dupe.Name)"
    }
}

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
$audioDir = Join-Path $assetRoot 'Audio Tracks'
if (-not (Test-Path $audioDir)) {
    Write-MissingSource 'Paper II listening audio (audio/test-02/*)' $audioDir '21 MP3s: 20260701_01..20 plus 20260701_00_Testing_volume.mp3'
} else {
    $tracks = @(Get-ChildItem -Path $audioDir -Filter '*.mp3' | Sort-Object Name)
    # 20 question clips + the 00 volume-testing track used by the pre-test sound check.
    if ($tracks.Count -ne 21) {
        Write-Warning "Expected 21 MP3s in '$audioDir', found $($tracks.Count)."
    }
    Test-AudioGroupIntegrity 'Paper II listening audio' @($tracks | ForEach-Object {
        @{ Key = "audio/test-02/$($_.Name)"; Path = $_.FullName }
    })
    foreach ($track in $tracks) {
        $key = "audio/test-02/$($track.Name)"
        if ($blockedKeys.ContainsKey($key)) { Write-Host "Skipping $key (failed integrity check)" -ForegroundColor Red; continue }
        Write-Host "Uploading $key"
        $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$key", '--file', $track.FullName, '--content-type', 'audio/mpeg') + $flags)
        if ($code -ne 0) { throw "Upload failed for $key" }
    }
}

# --- Paper III speaking prompt tracks ---
# Source filenames use spaces ("Speaking Prompt_Task 1.mp3"); R2 keys use
# underscores to match shared_resources.content_url in the Test 3 seed.
$paper3AudioDir = Join-Path $assetRoot 'Audio Tracks_Paper III'
if (-not (Test-Path $paper3AudioDir)) {
    Write-MissingSource 'Paper III speaking prompts (audio/test-03/Speaking_Prompt_Task_*)' $paper3AudioDir '7 MP3s named "Speaking Prompt_Task 1.mp3" .. "Speaking Prompt_Task 7.mp3"'
} else {
    $paper3Plan = @()
    for ($n = 1; $n -le 7; $n++) {
        $srcName = "Speaking Prompt_Task $n.mp3"
        $src = Join-Path $paper3AudioDir $srcName
        if (-not (Test-Path $src)) {
            Write-Warning "Missing Paper III track: $src"
            continue
        }
        $paper3Plan += @{ Key = "audio/test-03/Speaking_Prompt_Task_$n.mp3"; Path = $src; Name = $srcName }
    }
    Test-AudioGroupIntegrity 'Paper III speaking prompts' $paper3Plan
    foreach ($item in $paper3Plan) {
        $key = $item.Key
        if ($blockedKeys.ContainsKey($key)) { Write-Host "Skipping $key (failed integrity check)" -ForegroundColor Red; continue }
        Write-Host "Uploading $key (from $($item.Name))"
        $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$key", '--file', $item.Path, '--content-type', 'audio/mpeg') + $flags)
        if ($code -ne 0) { throw "Upload failed for $key" }
    }
}

$sfxDir = Join-Path $assetRoot 'system_sound_effects'
if (-not (Test-Path $sfxDir)) {
    Write-MissingSource 'Paper III recording beeps (audio/test-03/Recording_*)' $sfxDir 'Recording_Start_Sound_3Sec.MP3 and Recording_Stop_Sound.mp3'
} else {
    $sfxPlan = @()
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
            Write-Warning "Missing required Paper III system sound: $($sfx.File) in $sfxDir"
            Write-Host "    Paper III recording cues will not play until it is uploaded." -ForegroundColor DarkYellow
            $script:skipped += "Paper III system sound $($sfx.File)"
            continue
        }
        $sfxPlan += @{ Key = $sfx.Key; Path = $src }
    }
    Test-AudioGroupIntegrity 'Paper III recording cues' $sfxPlan
    foreach ($item in $sfxPlan) {
        if ($blockedKeys.ContainsKey($item.Key)) { Write-Host "Skipping $($item.Key) (failed integrity check)" -ForegroundColor Red; continue }
        Write-Host "Uploading $($item.Key)"
        $code = Invoke-Wrangler (@('r2', 'object', 'put', "$bucket/$($item.Key)", '--file', $item.Path, '--content-type', 'audio/mpeg') + $flags)
        if ($code -ne 0) { throw "Upload failed for $($item.Key)" }
    }
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

if ($skipped.Count -gt 0) {
    Write-Host ''
    Write-Warning "Done, but $($skipped.Count) audio group(s) were skipped because the masters are missing:"
    foreach ($item in $skipped) { Write-Host "  - $item" -ForegroundColor DarkYellow }
    Write-Host "  Searched under: $assetRoot" -ForegroundColor DarkYellow
    Write-Host "  Affected R2 keys stay at their previous contents (or absent). Re-run with -AssetSource once the masters are restored." -ForegroundColor DarkYellow
} elseif ($integrityFailures.Count -eq 0) {
    Write-Host 'Done.'
}

if ($integrityWarnings.Count -gt 0) {
    Write-Host ''
    Write-Warning "$($integrityWarnings.Count) empty master(s) - the uploaded objects will be silent:"
    foreach ($item in $integrityWarnings) { Write-Host "  - $item" -ForegroundColor DarkYellow }
}

if ($integrityFailures.Count -gt 0) {
    Write-Host ''
    Write-Host "INTEGRITY CHECK FAILED - $($integrityFailures.Count) duplicate-hash group(s):" -ForegroundColor Red
    foreach ($item in $integrityFailures) { Write-Host "  - $item" -ForegroundColor Red }
    Write-Host "  Those R2 keys were NOT uploaded and keep their previous contents." -ForegroundColor Red
    Write-Host "  Everything else was uploaded; re-run after the correct masters are supplied." -ForegroundColor Red
    exit 2
}
