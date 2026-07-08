# Publish UI changes (quick guide)

After you edit the frontend, run **one script**. It builds locally, commits, pushes to GitHub, and Cloudflare redeploys automatically.

**Production site:** https://eng-diagnostic.tzy667.workers.dev

---

## Every time you change the UI

From the project root in PowerShell:

```powershell
cd "d:\Coding\Project-for-Dr-Yeung\2-Kevin-English-Diagnostic-Test-Platform"
.\scripts\publish-ui.ps1
```

Or via npm:

```powershell
npm run publish:ui
```

The script will:

1. Run `npm run build` (fails fast if TypeScript/Vite errors)
2. Show changed files and ask for a **commit message**
3. `git commit` + `git push origin main`
4. Cloudflare **Workers Builds** picks up the push and deploys (~2–5 minutes)

### Options

| Command | When to use |
|---------|-------------|
| `.\scripts\publish-ui.ps1 -Message "Fix nav spacing"` | Skip commit message prompt |
| `.\scripts\publish-ui.ps1 -SkipBuild` | Only docs/config; no local build |
| `.\scripts\publish-ui.ps1 -DeployLocal` | Also run `wrangler deploy` on your PC (bypass slow CI or emergency fix) |

The script stages **only publishable files** (frontend, worker, migrations, docs). It skips vouchers, build output, Wrangler state, and local-only scripts such as `scripts/local-preview.ps1`.

---

## What you may need to do manually

### 1. If push asks you to log in (GitHub)

First time only, or if credentials expired:

- **Browser:** Git may open a browser — sign in to GitHub and approve.
- **Or** install [GitHub CLI](https://cli.github.com/) and run:
  ```powershell
  gh auth login
  ```

You do **not** need to log in to Cloudflare for normal UI updates (deploy is via Git).

### 2. If you use `-DeployLocal` (optional)

One-time on this machine:

```powershell
npx wrangler login
```

Approve in the browser when prompted.

### 3. After every publish — wait for Cloudflare

The script does **not** wait for Cloudflare. You do this once per publish:

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **eng-diagnostic** → **Deployments**
2. Wait for the latest **`main`** build → **Success** (green)
3. Open https://eng-diagnostic.tzy667.workers.dev in **incognito** (avoids cache)

**Good deploy log** should include:

```text
Read N files from the assets directory .../frontend/dist
env.DB (edt-diagnostic)      D1 Database
env.R2_ASSETS (edt-assets)   R2 Bucket
env.ASSETS                   Assets
```

If `env.R2_ASSETS` is missing from the log, Paper II audio and PDF downloads will fail in production — check that the root `wrangler.toml` still contains the `[[r2_buckets]]` block.

### 4. If Cloudflare build fails

1. Open the failed deployment → read the **build log**
2. Fix the error locally, run `.\scripts\publish-ui.ps1` again
3. Or **Retry deployment** in the dashboard if it was a transient error

| Log error | Fix |
|-----------|-----|
| TypeScript / Vite build failed | Fix code; script catches this locally first |
| `Invalid uuid` on D1 | Do not change `database_id` in wrangler unless recreating D1 |
| `run in the root of a workspace instead of targeting a specific project` | In Cloudflare → Workers Builds → **Deploy command** must be `npm run deploy` (not `npx wrangler deploy`). Then **Retry deployment**. |

### 5. If the site looks unchanged

- Hard refresh: `Ctrl+Shift+R` or incognito
- Confirm Cloudflare deployment **finished** (not still building)
- Confirm you pushed to **`main`** (production branch)

### 6. If you changed the database schema or test content (D1 migrations)

The question banks for **both papers live in D1** and ship as migrations (`0006`–`0008` created the unified schema + Test 1/Test 2 content; `0009`–`0010` added per-test voucher usage and activated Paper II). UI publish does **not** apply D1 migrations automatically. After a migration is merged to `main`, run once:

```powershell
.\scripts\migrate-remote-db.ps1
```

That script backs up remote D1 to `db_backup/`, applies pending migrations, optionally cleanses candidate data (submissions/sessions/attempts — vouchers and teacher credentials are kept; add `-SkipCleanse` to keep results), and verifies the row counts.

Manual equivalent (no backup, no cleanse):

```powershell
npx wrangler d1 export edt-diagnostic --remote --output db_backup/edt-diagnostic-<date>.sql
npx wrangler d1 migrations apply edt-diagnostic --remote -c wrangler.toml
```

For local preview, migrations run automatically via `local-preview.ps1`.

### 7. If you changed R2 assets (Paper II audio / PDF fonts)

Production audio clips (21 MP3s: 20 listening tracks + the sound-check track `20260701_00_Testing_volume.mp3`) and the report-PDF fonts live in the `edt-assets` R2 bucket, not in git. After adding or replacing MP3s in `Client_Feedback/Audio Tracks/` (or changing fonts), upload once to remote R2:

```powershell
.\scripts\upload-assets.ps1
```

If your `npx wrangler login` lacks R2 API permission (error `A request to the Cloudflare API (/accounts/.../r2/buckets) failed`), create an R2-scoped API token in the Cloudflare dashboard and set it for the session only:

```powershell
$env:CLOUDFLARE_API_TOKEN  = "<r2 api token>"
$env:CLOUDFLARE_ACCOUNT_ID = "<account id>"
.\scripts\upload-assets.ps1
Remove-Item Env:CLOUDFLARE_API_TOKEN, Env:CLOUDFLARE_ACCOUNT_ID
```

Never commit tokens. Local preview seeds its own copy automatically.

### 8. Admin page (`/admin`)

Production admin: https://eng-diagnostic.tzy667.workers.dev/admin

Local admin (after `local-preview.ps1`): http://localhost:5173/admin

Password is set in `wrangler.toml` as `ADMIN_PASSWORD` (default documented in deployment guide). Admin changes (voucher groups, metadata) use the **remote** D1 database — not the local one used during preview.

---

## What the script never commits

These stay local and are skipped by `publish-ui.ps1` (and/or `.gitignore`):

- `Evouchers.txt`, `seed-vouchers.sql`
- `scripts/local-preview.ps1` (local dev helper)
- `db_backup/` (production D1 exports)
- `.fonts-cache/` (downloaded PDF fonts)
- `frontend/dist/` (built on Cloudflare during deploy)
- `.dev.vars`, `.wrangler/`, `worker/.wrangler/`, `.cursor/`, `Client_Feedback/` (incl. audio masters)

These **can** be committed when changed: `PUBLISH_UI.md`, `scripts/publish-ui.ps1`, `scripts/upload-assets.ps1`, `scripts/migrate-remote-db.ps1`, the seed generators (`scripts/generate-test1-seed.mjs`, `scripts/generate-test2-seed.mjs`, `scripts/test2-content.mjs`), worker/frontend code, `migrations/`, and the docs (`README.md`, `DATABASE_README.md`, `TEST_BANK_GUIDE.md`, `AGENTS.md`).

---

## Local preview before publishing

One command (opens Worker + Vite in new windows and your browser):

```powershell
.\scripts\local-preview.ps1
```

Or via npm:

```powershell
npm run preview:local
```

The script will:

1. Apply local D1 migrations — this includes the **full question banks for Paper I and Paper II** (unified schema, attempts tables, `voucher_test_usage`), so a fresh machine gets a complete test platform
2. Seed vouchers from `Evouchers.txt` (or `TEST-LOCAL-001` if absent) and a teacher credential into the **local** database
3. Reset voucher usage and wipe local attempts/reports/sessions, so every voucher can sit **both papers** again (3 attempts per paper per run)
4. Check the **local R2 simulation** and, if missing, seed the 20 Paper II listening MP3s and the report-PDF fonts (first run downloads the fonts once into `.fonts-cache/`)
5. Start `npm run worker:dev` (Terminal 1)
6. Start `npm run dev` (Terminal 2)
7. Open http://localhost:5173

Use any code from `Evouchers.txt` (e.g. `4K2M-9R7T-1F5P`), then on the info screen pick **Paper I** (grammar & vocabulary, classic flow) or **Paper II** (listening & reading — once-only audio playback, reading passages, server-side scoring, and the **Download PDF** button rendered by the local Worker). Vite proxies `/api/*` — including audio streaming and the PDF download — to `http://127.0.0.1:8787`.

Admin UI locally: http://localhost:5173/admin (same `ADMIN_PASSWORD` as production).

Options:

| Command | When to use |
|---------|-------------|
| `.\scripts\local-preview.ps1 -SkipSeed` | Keep existing local data (incl. attempts); just restart servers |
| `.\scripts\local-preview.ps1 -SkipAssets` | Skip the R2 asset check (fastest, if audio/PDF not needed) |
| `.\scripts\local-preview.ps1 -ReseedAssets` | Force re-upload of audio + fonts to local R2 |

Note: the local Worker uses `worker/wrangler.toml`, which declares the same `DB` and `R2_ASSETS` bindings as production but stores everything under `worker/.wrangler/state` — completely separate from Cloudflare.

---

## Full setup reference

Initial Cloudflare/Git/D1 setup: [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)
