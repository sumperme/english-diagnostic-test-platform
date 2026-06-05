# Publish UI changes: verify build, commit, push to GitHub (triggers Cloudflare deploy).
# Usage:
#   .\scripts\publish-ui.ps1
#   .\scripts\publish-ui.ps1 -Message "Update landing hero copy"
#   .\scripts\publish-ui.ps1 -SkipBuild
#   .\scripts\publish-ui.ps1 -DeployLocal   # also run wrangler deploy (requires wrangler login)

param(
    [string]$Message = "",
    [switch]$SkipBuild,
    [switch]$DeployLocal
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Write-Step([string]$text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

Write-Step "Project: $repoRoot"

if (-not (Test-Path ".git")) {
    throw "Not a git repository. Run this script from the project root."
}

$remoteUrl = (git remote get-url origin 2>$null)
if (-not $remoteUrl) {
    throw "No git remote 'origin' configured."
}

Write-Host "Remote: $remoteUrl"

if (-not $SkipBuild) {
    Write-Step "Building frontend and typechecking worker..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed. Fix errors before publishing."
    }
    Write-Host "Build OK." -ForegroundColor Green
} else {
    Write-Host "Skipping local build (-SkipBuild)." -ForegroundColor Yellow
}

Write-Step "Checking for changes..."
$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit. Working tree is clean." -ForegroundColor Yellow
    exit 0
}

git status -sb

if (-not $Message) {
    $Message = Read-Host "Commit message (e.g. Update quiz button styling)"
    if (-not $Message.Trim()) {
        $Message = "Update UI."
    }
}

Write-Step "Staging changes..."
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "No staged changes after git add (ignored files only?)." -ForegroundColor Yellow
    exit 0
}

Write-Host "Staged files:"
$staged | ForEach-Object { Write-Host "  $_" }

Write-Step "Committing..."
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    throw "git commit failed."
}

Write-Step "Pushing to origin/main..."
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Push failed. You may need to sign in to GitHub." -ForegroundColor Red
    Write-Host "See PUBLISH_UI.md section 'If push asks you to log in'." -ForegroundColor Yellow
    exit 1
}

Write-Host "Push OK." -ForegroundColor Green

if ($DeployLocal) {
    Write-Step "Deploying to Cloudflare locally (wrangler)..."
    npx wrangler deploy -c wrangler.toml
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Local wrangler deploy failed. You may need: npx wrangler login" -ForegroundColor Red
        Write-Host "Cloudflare may still deploy from GitHub if the push succeeded." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Local deploy OK." -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Published to GitHub (main)" -ForegroundColor Green
Write-Host " Cloudflare Workers Builds will deploy automatically." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Production URL: https://eng-diagnostic.tzy667.workers.dev"
Write-Host ""
Write-Host "Next (manual, ~2-3 min):"
Write-Host "  1. Open Cloudflare Dashboard -> Workers & Pages -> eng-diagnostic -> Deployments"
Write-Host "  2. Wait until the latest build shows Success"
Write-Host "  3. Open the site in an incognito window to verify UI changes"
Write-Host ""
Write-Host "Details: PUBLISH_UI.md"
