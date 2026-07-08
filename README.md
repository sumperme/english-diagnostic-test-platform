# English Diagnostic Test (EDT) Platform

A CEFR-aligned (C1/C2) English diagnostic testing platform for university-bound learners, built on Cloudflare Workers. Candidates sit timed multiple-choice papers with an e-voucher, receive a bilingual (English / 繁體中文) diagnostic report on screen, and download a server-rendered PDF. Teachers and administrators have dedicated dashboards.

**Production:** https://eng-diagnostic.tzy667.workers.dev
**Admin console:** https://eng-diagnostic.tzy667.workers.dev/admin
**Teacher dashboard:** https://eng-diagnostic.tzy667.workers.dev/teacher

---

## The papers

| Paper | Content | Questions | Time |
| ----- | ------- | --------- | ---- |
| **Paper I — Applied Grammar & Vocabulary** | Gap-fill MCQs across 12 grammar dimensions + common and specialized vocabulary | 90 (60 + 30) | 60 min |
| **Paper II — Listening & Reading** | Listening extracts (played **once only**, with a pre-test sound check) + reading passages of various genres | 45 (20 + 25) | 60 min |

Each voucher grants a configurable number of attempts **per paper**. Results map to CEFR bands (with indicative IELTS / TOEFL ranges), a per-dimension radar profile, and study recommendations.

## Features

- **Voucher access control** — codes are batch-generated in the admin console, grouped by user group (class), with per-test usage tracking.
- **DB-backed test bank** — questions live in Cloudflare D1 under a unified `TT-PP-SS-GGG-QQ` ID scheme (test / part / dimension / group / variant); the Worker serves one random variant per question group and scores server-side (Paper II attempts API).
- **Reports** — on-screen bilingual report (radar chart, CEFR bands, question review) plus a server-rendered PDF (`pdf-lib` in the Worker, Montserrat + Noto Serif TC from R2, FIFO cache of the latest 20 PDFs).
- **Teacher dashboard** — cohort statistics, score distributions, per-dimension and per-question correct rates for the teacher's user group.
- **Admin console** — voucher CRUD, batch generation, per-test usage columns, teacher credential management.
- **Bilingual UI** — English and Traditional Chinese (zh-HK) throughout, including PDFs.

## Architecture

```text
Browser (React + Vite SPA, Tailwind)
   │  /api/*                                  /*
   ▼                                          ▼
Cloudflare Worker (worker/src/index.ts)   Static assets (frontend/dist via ASSETS)
   ├─ Voucher / session auth (D1)
   ├─ Attempts API: random variant selection, server-side scoring (Paper II)
   ├─ Legacy submit + dual-write into unified attempt tables (Paper I)
   ├─ Teacher + admin APIs
   ├─ Authenticated audio streaming  ──►  R2 (edt-assets: audio/, fonts/, pdf-cache/)
   └─ PDF report rendering (pdf-lib) ──►  D1 (edt-diagnostic: test bank + attempts + reports)
```

- **D1** (`edt-diagnostic`) stores the question banks for both papers, vouchers, sessions, attempts, layout-free report variables (`rv1`), and score-conversion bands. Schema: [DATABASE_README.md](DATABASE_README.md).
- **R2** (`edt-assets`) stores the 21 Paper II MP3s (20 listening clips + 1 volume-check track), PDF fonts, and the PDF cache. Audio is only reachable through the Worker with an active session or teacher key.
- Deployment is git-driven: pushing `main` triggers Cloudflare Workers Builds.

## Repository layout

| Path | Purpose |
| ---- | ------- |
| `frontend/` | React + Vite SPA (screens, components, i18n dictionaries, client scoring for Paper I) |
| `worker/` | Cloudflare Worker API (attempts, scoring, reports/PDF, admin, teacher, asset streaming) |
| `migrations/` | D1 migrations `0001`–`0010` (legacy tables → unified test bank + both papers' content) |
| `scripts/` | PowerShell + Node helpers: local preview, publish, asset upload, remote DB migrate, seed generators |
| `wrangler.toml` | Production Worker config (D1 + R2 bindings, SPA assets) |
| `worker/wrangler.toml` | Local dev Worker config (same bindings, state under `worker/.wrangler/state`) |

## Quick start (local)

Prerequisites: Node 20+, npm.

```powershell
npm install
.\scripts\local-preview.ps1
```

The preview script applies all D1 migrations locally (full question banks for both papers), seeds vouchers and a teacher credential, seeds the local R2 simulation (audio + fonts), then starts the Worker (port 8787) and Vite (port 5173) and opens the browser. See [PUBLISH_UI.md](PUBLISH_UI.md) for options.

## Deployment

Day-to-day (frontend/worker changes):

```powershell
.\scripts\publish-ui.ps1          # build, commit, push -> Cloudflare deploys
```

After changing the database schema or test content:

```powershell
.\scripts\migrate-remote-db.ps1   # backup, apply migrations to remote D1, verify
```

After changing audio or fonts:

```powershell
.\scripts\upload-assets.ps1       # upload MP3s + fonts to remote R2
```

Full guides: [PUBLISH_UI.md](PUBLISH_UI.md) (publish workflow), [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) (initial setup and troubleshooting).

## Documentation

| Document | Contents |
| -------- | -------- |
| [DATABASE_README.md](DATABASE_README.md) | Unified 12-table schema, ER diagram, question ID spec, attempt flow, report variables |
| [TEST_BANK_GUIDE.md](TEST_BANK_GUIDE.md) | Test bank model, dimensions, scoring, how to add or change questions |
| [PUBLISH_UI.md](PUBLISH_UI.md) | Publish workflow, local preview, migrations, asset uploads |
| [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) | One-time Cloudflare setup, Workers Builds settings, troubleshooting |
| [USER_GUIDE.md](USER_GUIDE.md) | End-user walkthrough (candidates, teachers, admin) |
| [AGENTS.md](AGENTS.md) | Design system tokens and rules for AI-assisted development |

## Security notes

- Voucher codes (`Evouchers.txt`), database backups (`db_backup/`), and `.dev.vars` are never committed.
- Listening audio is never publicly reachable; the Worker streams it only to authenticated sessions.
- Correct answers and transcripts never leave the server before an attempt is completed.

## License

Public domain (Unlicense) — see [LICENSE](LICENSE).
