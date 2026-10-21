# Publish UI changes (quick guide)

After you edit the frontend, run **one script**. It builds locally, commits, pushes to GitHub, and Cloudflare redeploys automatically.

**Production site:** https://eng-diagnostic.tzy667.workers.dev

This page covers the day-to-day workflow: publishing, D1 migrations, R2 asset uploads, secrets,
and local preview. One-time Cloudflare/Git/D1 setup, the Workers Builds settings, and the full
troubleshooting table are in the [appendix](#appendix--initial-setup-and-troubleshooting) at
the bottom. Completed one-time data migrations live in [`HISTORY.md`](HISTORY.md).

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
5. Print a **post-publish checklist** (D1 / R2 / secrets / Queue). When the commit includes Paper III–related paths, that checklist is highlighted.

### Options

| Command | When to use |
|---------|-------------|
| `.\scripts\publish-ui.ps1 -Message "Fix nav spacing"` | Skip commit message prompt |
| `.\scripts\publish-ui.ps1 -SkipBuild` | Only docs/config; no local build |
| `.\scripts\publish-ui.ps1 -DeployLocal` | Also run `wrangler deploy` on your PC (bypass slow CI or emergency fix) |

The script stages **only publishable files** (frontend, worker, migrations, docs). It skips vouchers, build output, Wrangler state, and local-only scripts such as `scripts/local-preview.ps1`.

---

## Paper III go-live checklist (dataset beyond UI)

A UI-only push does **not** activate Paper III on production data. After publishing code that introduces or updates Paper III, run these once (or when the relevant assets/migrations change):

| Step | Command / action | Why |
|------|------------------|-----|
| 1. D1 migrations | `.\scripts\migrate-remote-db.ps1 -SkipCleanse` | Apply pending schema/seed (including `0020` Paper I replace). **`-SkipCleanse` keeps Papers II/III attempts; `0020` still wipes Paper I history.** |
| 2. R2 audio | `.\scripts\upload-assets.ps1` | Paper III prompts + start/stop beeps under `audio/test-03/` (plus Paper II MP3s / fonts if missing) |
| 3. Secrets | `npx wrangler secret put DEEPSEEK_API_KEY` / `ASSEMBLYAI_API_KEY` / `ASSEMBLYAI_WEBHOOK_SECRET` | Grading + STT (never commit keys) |
| 4. Queue | Create once if missing: `npx wrangler queues create edt-paper3-grade`. Confirm deploy log shows `PAPER3_GRADE` / producer+consumer for `edt-paper3-grade` | Async Paper III marking |
| 5. Verify | Incognito: paper picker shows Paper III; mic/speaker gate loads | End-to-end smoke check |

Expected bank size after migrate: **3 tests**, **145** question groups / questions (`90 + 45 + 10`).

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

Also look for the Paper III queue producer/consumer (`PAPER3_GRADE` / `edt-paper3-grade`) when that binding is in `wrangler.toml`.

If `env.R2_ASSETS` is missing from the log, Paper II/III audio and PDF downloads will fail in production — check that the root `wrangler.toml` still contains the `[[r2_buckets]]` block.

### 4. If Cloudflare build fails

1. Open the failed deployment → read the **build log**
2. Fix the error locally, run `.\scripts\publish-ui.ps1` again
3. Or **Retry deployment** in the dashboard if it was a transient error

| Log error | Fix |
|-----------|-----|
| TypeScript / Vite build failed | Fix code; script catches this locally first |
| `Invalid uuid` on D1 | Do not change `database_id` in wrangler unless recreating D1 |
| `run in the root of a workspace instead of targeting a specific project` | In Cloudflare → Workers Builds → **Deploy command** must be `npm run deploy`, not a bare `npx wrangler deploy` ([why](#why-the-deploy-command-must-be-npm-run-deploy)). Then **Retry deployment**. |

### 5. If the site looks unchanged

- Hard refresh: `Ctrl+Shift+R` or incognito
- Confirm Cloudflare deployment **finished** (not still building)
- Confirm you pushed to **`main`** (production branch)

### 6. If you changed the database schema or test content (D1 migrations)

The question banks for **all three papers live in D1** and ship as migrations (`0006`–`0008` unified schema + Papers I/II; `0009`–`0010` per-test voucher usage + activate Paper II; `0014`–`0019` Paper III schema/seed/activate + prompt copy + class-overview `test_code`; **`0020` Paper I 30-variant bank replace**). UI publish does **not** apply D1 migrations automatically. After a migration is merged to `main`, run once:

```powershell
.\scripts\migrate-remote-db.ps1
```

**`0020` is destructive for Paper I.** It deletes live Paper I attempts, answers, reports, PDF cache rows, class overviews for test `01`, and all `submissions` rows, then replaces groups `001`–`090`. Export a backup first. `-SkipCleanse` still cannot preserve Paper I history once `0020` applies; it only keeps Papers II/III candidate data.

Use `-SkipCleanse` for additive go-live that must keep Papers II/III attempts. Use a full cleanse when you also want sessions/vouchers reset.

That script backs up remote D1 to `db_backup/` (unless `-SkipBackup`), applies pending migrations, optionally cleanses, and verifies row counts (**3 tests**, **145** groups, **2,695** questions and **1,869** feedback items after `0020`; `0021` only reformats feedback text).

Manual equivalent (no backup, no cleanse):

```powershell
npx wrangler d1 export edt-diagnostic --remote --output db_backup/edt-diagnostic-<date>.sql
npx wrangler d1 migrations apply edt-diagnostic --remote -c wrangler.toml
```

For local preview, migrations run automatically via `local-preview.ps1`.

### 7. If you changed R2 assets (Paper II / Paper III audio / PDF fonts)

Production audio lives in the `edt-assets` R2 bucket, not in git:

- **Paper II:** 21 MP3s (20 listening tracks + sound-check `20260701_00_Testing_volume.mp3`)
- **Paper III:** 7 speaking prompts + `Recording_Start_Sound_3Sec.mp3` / `Recording_Stop_Sound.mp3` under `audio/test-03/`
- **Fonts:** Montserrat + Noto Serif TC for PDF reports

After adding or replacing masters in `Client_Feedback/` (or changing fonts), upload once to remote R2:

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

`ADMIN_PASSWORD` is a **secret**, never a `[vars]` entry. Set it once per environment:

```powershell
npx wrangler secret put ADMIN_PASSWORD
```

Locally, `wrangler dev` reads it from `worker/.dev.vars` (gitignored). Admin routes fail closed — every `/api/admin/*` route returns **503** while the secret is unset, so a missing value locks admin out rather than opening it up. Admin changes (voucher groups, metadata) use the **remote** D1 database — not the local one used during preview.

---

## What the script never commits

These stay local and are skipped by `publish-ui.ps1` (and/or `.gitignore`):

- `Evouchers.txt`, `seed-vouchers.sql`
- `scripts/local-preview.ps1` (local dev helper)
- `db_backup/` (production D1 exports)
- `.fonts-cache/` (downloaded PDF fonts)
- `frontend/dist/` (built on Cloudflare during deploy)
- `.dev.vars`, `.wrangler/`, `worker/.wrangler/`, `.cursor/`, `Client_Feedback/` (incl. audio masters)

These **can** be committed when changed: `scripts/publish-ui.ps1`, `scripts/upload-assets.ps1`, `scripts/migrate-remote-db.ps1`, the seed generators (`scripts/generate-paper1-seed.mjs`, `scripts/extract-paper1-bank.mjs`, `scripts/extract-paper1-feedback.mjs`, `scripts/docx-text.mjs`, `scripts/generate-test2-seed.mjs`, `scripts/generate-test3-seed.mjs`, `scripts/test2-content.mjs`, `scripts/test3-content.mjs`), worker/frontend code, `migrations/` (through `0021`), and the docs (`README.md`, `AGENTS.md`, and everything under `docs/`).

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

1. Apply local D1 migrations through **`0021`** — full banks for **Papers I–III** (unified schema, attempts tables, `voucher_test_usage`, Paper III schema/seed/activate + prompt copy, Paper I 30-variant bank replace, Paper I feedback italics/links)
2. Seed vouchers from `Evouchers.txt` (or `TEST-LOCAL-001` if absent) and a teacher credential into the **local** database
3. Reset voucher usage and wipe local attempts/reports/sessions, so every voucher can sit **each paper** again (3 attempts per paper per run)
4. Check the **local R2 simulation** and, if missing, seed Paper II listening MP3s, Paper III speaking prompts + beeps, and report-PDF fonts (first run downloads the fonts once into `.fonts-cache/`)
5. Require `worker/.dev.vars` keys for Paper III local STT/grading (`ASSEMBLYAI_API_KEY`, `DEEPSEEK_API_KEY` — it generates `ASSEMBLYAI_WEBHOOK_SECRET` for you if missing)
6. Start `npm run worker:dev` (Terminal 1)
7. Start `npm run dev` (Terminal 2)
8. Open http://localhost:5173

It also prints the sample voucher and the local teacher credential (`TEACHER-LOCAL-001`, user group `Class-ENG101`) so you can reach the teacher dashboard.

Locally, AssemblyAI cannot call back into `localhost`, so Paper III speech-to-text runs by **Queue polling** rather than webhook: `ASSEMBLYAI_WEBHOOK_BASE` is left unset and the grading consumer polls for finished transcripts. Webhooks only apply on a publicly reachable deploy where that variable is set.

Do **not** run the two servers by hand instead of this script. `npm run worker:dev` plus `npm run dev` alone skips the migrations, the voucher/teacher seed, the `.dev.vars` check, and the local R2 seeding — which leaves Paper II with no listening audio, Paper III with no prompts or grading, and no working PDF download.

Use any code from your local `Evouchers.txt` (the script prints the first one it seeded; without that file it seeds `TEST-LOCAL-001`), then on the info screen pick **Paper I**, **Paper II**, or **Paper III**. Vite proxies `/api/*` — including audio streaming and PDF download — to `http://127.0.0.1:8787`.

Admin UI locally: http://localhost:5173/admin, using the `ADMIN_PASSWORD` from `worker/.dev.vars`.

Options:

| Command | When to use |
|---------|-------------|
| `.\scripts\local-preview.ps1 -SkipSeed` | Keep existing local data (incl. attempts); just restart servers |
| `.\scripts\local-preview.ps1 -SkipAssets` | Skip the R2 asset check (fastest, if audio/PDF not needed) |
| `.\scripts\local-preview.ps1 -ReseedAssets` | Force re-upload of audio + fonts to local R2 |

Note: the local Worker uses `worker/wrangler.toml`, which declares the same `DB`, `R2_ASSETS`, and `PAPER3_GRADE` bindings as production but stores everything under `worker/.wrangler/state` — completely separate from Cloudflare.

---

# Appendix — initial setup and troubleshooting

One-time platform setup is already complete; this appendix records the settings that must stay
as they are, and what to do when one of them breaks. Completed one-time data migrations are in
[`HISTORY.md`](HISTORY.md).

**GitHub repo:** https://github.com/sumperme/english-diagnostic-test-platform
**Cloudflare Worker:** `eng-diagnostic` (Workers Builds on `main`)

## Deploy pipeline

```text
You edit code → publish-ui.ps1 → git push main → Cloudflare Workers Builds
                     │                              ├─ npm run build
                     │                              └─ npm run deploy
                     └─ local build check (optional)

https://eng-diagnostic.tzy667.workers.dev
  ├─ /api/*  → Worker (worker/src/index.ts)
  └─ /*      → frontend/dist (React SPA via the ASSETS binding)
```

The Worker owns every `/api/*` path: voucher and session auth, the attempts API for
Papers I–III (`/api/attempts...`; Paper I no longer uses `/api/submit`), Paper III audio upload
and the AssemblyAI webhook, report and PDF rendering (`/api/reports/:attemptId/pdf`), teacher
and admin APIs, AI feedback, and authenticated R2 asset streaming (`/api/assets/...`). Root
`wrangler.toml` routes this with `run_worker_first = ["/api/*"]`; everything else falls through
to the SPA via `not_found_handling = "single-page-application"`.

## Workers Builds settings (do not change)

| Field | Value |
| ----- | ----- |
| Repository | `sumperme/english-diagnostic-test-platform` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Root directory | `/` |

### Why the deploy command must be `npm run deploy`

Both forms end up running the same thing — root `package.json` defines:

```json
"deploy": "npx wrangler deploy -c wrangler.toml"
```

The difference is **where** it runs. This repo is an npm workspace root (`frontend`, `worker`),
so invoking `npx wrangler deploy` as the Cloudflare **Deploy command** trips Wrangler's
workspace detection and fails with *"Wrangler application detection logic has been run in the
root of a workspace instead of targeting a specific project."* Going through the npm script
avoids that. So:

- **Cloudflare Workers Builds → Deploy command:** `npm run deploy` (required).
- **From your own machine:** either works. `.\scripts\publish-ui.ps1 -DeployLocal` runs
  `npx wrangler deploy -c wrangler.toml` directly and is fine, because it executes from the
  repo root as an ordinary shell command rather than through Wrangler's CI project detection.

## Root `wrangler.toml` (production)

```toml
name = "eng-diagnostic"
main = "worker/src/index.ts"

[assets]
directory = "./frontend/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

Plus a `[[d1_databases]]` binding (`DB` → `edt-diagnostic`), a `[[r2_buckets]]` binding
(`R2_ASSETS` → `edt-assets`), producer and consumer blocks for the `edt-paper3-grade` queue
(`PAPER3_GRADE`), and `[vars]` for `ALLOWED_ORIGIN` and `SESSION_TTL_SECONDS`.

The D1 `database_id` lives only in `wrangler.toml` / `worker/wrangler.toml` — do not copy it
into documentation or other source files. To find the database: `npx wrangler d1 list`.

### Secrets (never in `[vars]`, never committed)

| Secret | Needed for |
| ------ | ---------- |
| `ADMIN_PASSWORD` | `/admin` console; all `/api/admin/*` return 503 while unset |
| `DEEPSEEK_API_KEY` | AI tutor feedback, teacher class overviews, Paper III rubric grading |
| `ASSEMBLYAI_API_KEY` | Paper III speech-to-text |
| `ASSEMBLYAI_WEBHOOK_SECRET` | Authenticates the AssemblyAI callback |
| `ASSEMBLYAI_WEBHOOK_BASE` | Optional; set to a public base URL to use STT webhooks instead of queue polling |

```powershell
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put ASSEMBLYAI_API_KEY
npx wrangler secret put ASSEMBLYAI_WEBHOOK_SECRET
```

Locally these live in `worker/.dev.vars` (gitignored).

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Cloudflare Access login page instead of the site | Cloudflare One → Access → policy **Everyone** |
| CORS error | `ALLOWED_ORIGIN` must match the browser URL; push and redeploy |
| `{"error":"Not found"}` on `/` | Redeploy; the deploy log must show `env.ASSETS` |
| UI not updated | Wait for Cloudflare **Success**, then incognito / hard refresh |
| Invalid voucher | Confirm the code exists in D1 and has per-paper uses remaining (see [`USER_GUIDE.md`](USER_GUIDE.md)) |
| Admin login rejected, or `/api/admin/*` returns 503 | `ADMIN_PASSWORD` secret is unset or wrong — `npx wrangler secret put ADMIN_PASSWORD` |
| Paper II/III audio or PDF download fails | `env.R2_ASSETS` missing from the deploy log, or R2 never seeded — check the `[[r2_buckets]]` block and run `.\scripts\upload-assets.ps1` |
| Paper III stuck "being marked" | Queue `edt-paper3-grade` missing, or `ASSEMBLYAI_API_KEY` / `DEEPSEEK_API_KEY` unset |
| Push failed | GitHub login — see *If push asks you to log in* above |
| Build failed on Cloudflare | Fix locally, run `npm run build`, publish again |
| `Wrangler application detection logic has been run in the root of a workspace` | **Deploy command** must be `npm run deploy` — see above — then **Retry deployment** |
| `Invalid uuid` on D1 | Do not change `database_id` in `wrangler.toml` unless you are recreating the database |

### Emergency local deploy (skip CI)

```powershell
npx wrangler login   # once, if needed
npm run build
npm run deploy
```

## Re-seed vouchers (rare)

Generates SQL from your local voucher list, applies it, then deletes the generated file.
Never commit `Evouchers.txt` or `seed-vouchers.sql`.

```powershell
$codes = Get-Content ".\Evouchers.txt" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$values = ($codes | ForEach-Object { "('$_')" }) -join ",`n"
$sql = "INSERT OR IGNORE INTO vouchers (code) VALUES`n$values;"
$sql | Set-Content -Path ".\seed-vouchers.sql" -Encoding utf8 -NoNewline
npx wrangler d1 execute edt-diagnostic --remote --file=.\seed-vouchers.sql
Remove-Item .\seed-vouchers.sql
```

Prefer the admin console's batch generator for normal voucher creation.

## Security reminders

- Never commit `Evouchers.txt`, `seed-vouchers.sql`, `.dev.vars`, or `db_backup/` exports.
- Voucher codes are normalized to uppercase by the Worker.
- Quiz copy protection is client-side only (`preventCopy` on `QuestionCard`).
- Listening/speaking audio and candidate recordings are served only through the authenticated
  `/api/assets/...` route — never a public R2 URL.
