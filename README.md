# English Diagnostic Test (EDT) Platform

A CEFR-aligned (C1/C2) English diagnostic testing platform for university-bound learners, built on Cloudflare Workers. Candidates sit timed papers with an e-voucher, receive a bilingual (English / 繁體中文) diagnostic report on screen, and download a server-rendered PDF. Teachers and administrators have dedicated dashboards.

**Production:** https://eng-diagnostic.tzy667.workers.dev
**Admin console:** https://eng-diagnostic.tzy667.workers.dev/admin
**Teacher dashboard:** https://eng-diagnostic.tzy667.workers.dev/teacher

---

## The papers

| Paper | Content | Items | Time |
| ----- | ------- | ----- | ---- |
| **Paper I — Applied Grammar & Vocabulary** | Gap-fill MCQs across 12 grammar dimensions + common and specialized vocabulary | 90 (60 + 30) | 60 min |
| **Paper II — Listening & Reading** | Listening extracts (played **once only**, with a pre-test sound check) + reading passages of various genres | 45 (20 + 25) | 60 min |
| **Paper III — Speaking & Writing** | One-shot speaking responses to prompt audio (mic + speaker check) + two writing tasks; async speech-to-text and rubric grading | 10 (8 speaking + 2 writing) | ~60 min |

Each voucher grants a configurable number of attempts **per paper**, consumed at submit. Results map to CEFR bands (with indicative IELTS / TOEFL ranges), study recommendations, and (Papers I–II) a per-dimension radar profile.

## Features

- **Voucher access control** — codes are batch-generated in the admin console, grouped by user group (class), with per-paper usage tracking.
- **DB-backed test bank** — questions live in Cloudflare D1 under a unified `TT-PP-SS-GGG-QQ` ID scheme (test / part / dimension / group / variant). Paper I has 90 slots `001`–`090`: Part A grammar `001`–`060` (`SS` `01`–`12`, 30 variants each) and Part B vocabulary `061`–`090` (`SS` `01`–`04` for B1, B2, C1, C2). Part B holds about 30 variants per slot, and the count varies (15, 25, 30, 33, or 34). An exam still serves one variant per slot (90 items: Part A /60 + Part B /30). The Worker serves one random variant per group (Papers I–II) or fixed order (Paper III) and scores / marks server-side via the attempts API. Paper I Part B stays in canonical order.
- **Reports** — on-screen bilingual report (CEFR bands, question review; radar for Papers I–II) plus a server-rendered PDF (`pdf-lib` in the Worker, Montserrat + Noto Serif TC from R2, FIFO cache of the latest 20 PDFs).
- **AI tutor feedback (DeepSeek)** — candidates generate bilingual personalized feedback once per completed attempt; teachers generate class overviews per paper against a shared quota; feedback appears on results screens and in server-rendered PDFs; the admin console shows API call count and estimated spend.
- **Paper III pipeline** — speaking uploads go to R2; AssemblyAI transcribes; a Cloudflare Queue (`PAPER3_GRADE` / `edt-paper3-grade`) drives DeepSeek rubric bands (`b1b2` / `c1` / `c2`).
- **Teacher dashboard** — cohort statistics and paper filter (I–III); Paper III review includes recordings, transcripts, and essays.
- **Admin console** — voucher CRUD, batch generation, per-paper usage columns, teacher credential management, AI spend log.
- **Bilingual UI** — English and Traditional Chinese (zh-HK) throughout, including PDFs.

## Architecture

```text
Browser (React + Vite SPA, Tailwind)
   │  /api/*                                  /*
   ▼                                          ▼
Cloudflare Worker (worker/src/index.ts)   Static assets (frontend/dist via ASSETS)
   ├─ Voucher / session auth (D1)
   ├─ Attempts API: Papers II–III (variant/order, scoring, async Paper III grading)
   ├─ Legacy submit + dual-write into unified attempt tables (Paper I)
   ├─ Teacher + admin APIs
   ├─ AI feedback (DeepSeek): student feedback + teacher class overviews
   ├─ Paper III: audio upload → AssemblyAI STT → Queue PAPER3_GRADE → DeepSeek rubrics
   ├─ Authenticated audio streaming  ──►  R2 (edt-assets: audio/, responses/, fonts/, pdf-cache/)
   └─ PDF report rendering (pdf-lib) ──►  D1 (edt-diagnostic: test bank + attempts + reports)
```

- **D1** (`edt-diagnostic`) stores the question banks for all three papers, vouchers, sessions, attempts, layout-free report variables (`rv1`), and score-conversion bands. Schema: [docs/DATABASE_README.md](docs/DATABASE_README.md).
- **R2** (`edt-assets`) stores Paper II listening MP3s, Paper III speaking prompts + system beeps, candidate speaking responses, PDF fonts, and the PDF cache. Audio is only reachable through the Worker with an active session or teacher key.
- Deployment is git-driven: pushing `main` triggers Cloudflare Workers Builds.

## Repository layout

Top level: `frontend/` (React + Vite SPA), `worker/` (Cloudflare Worker API), `migrations/` (D1 migrations `0001`–`0019`), `scripts/` (PowerShell + Node helpers), `docs/`, and the Worker configs `wrangler.toml` (production) and `worker/wrangler.toml` (local dev).

The canonical, file-by-file repository map — migrations, scripts, worker modules, and frontend screens — lives in [docs/TEST_BANK_GUIDE.md § Repository file map](docs/TEST_BANK_GUIDE.md#10-repository-file-map-canonical).

## Quick start (local)

Prerequisites: Node 20+, npm.

```powershell
npm install
.\scripts\local-preview.ps1
```

One command prepares everything local — D1 migrations, vouchers, a teacher credential, the R2 asset simulation — then starts the Worker and Vite and opens the browser. Do not start the dev servers by hand instead; see [docs/PUBLISH_UI.md](docs/PUBLISH_UI.md) for why, and for all options.

## Deployment

```powershell
.\scripts\publish-ui.ps1          # build, commit, push -> Cloudflare deploys
```

Code pushes do **not** update the database, R2 assets, or secrets. When those change you also need `.\scripts\migrate-remote-db.ps1` (D1 schema / test content), `.\scripts\upload-assets.ps1` (audio and PDF fonts), and `npx wrangler secret put ...` for `ADMIN_PASSWORD`, `DEEPSEEK_API_KEY`, `ASSEMBLYAI_API_KEY`, and `ASSEMBLYAI_WEBHOOK_SECRET`.

[docs/PUBLISH_UI.md](docs/PUBLISH_UI.md) is the authority on all of this, including the Paper III go-live checklist, Workers Builds settings, and troubleshooting.

## Documentation

| Document | Contents |
| -------- | -------- |
| [docs/PUBLISH_UI.md](docs/PUBLISH_UI.md) | Publish workflow, local preview, migrations, asset uploads, secrets, Cloudflare setup and troubleshooting |
| [docs/DATABASE_README.md](docs/DATABASE_README.md) | D1 schema, ER diagram, question ID spec, attempts API contract, report variables, PDF cache |
| [docs/TEST_BANK_GUIDE.md](docs/TEST_BANK_GUIDE.md) | Test bank model, dimensions, scoring and CEFR grids, how to add or change questions, repository file map |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | End-user walkthrough (candidates, teachers, admin) |
| [docs/HISTORY.md](docs/HISTORY.md) | Completed one-time migrations and initial setup, kept for the record |
| [AGENTS.md](AGENTS.md) | Design system tokens and rules for AI-assisted development |

## Security notes

- Voucher codes (`Evouchers.txt`), database backups (`db_backup/`), `.dev.vars`, and all API keys and secrets are never committed. `ADMIN_PASSWORD` is a Wrangler secret, not a config var.
- Listening / speaking prompt audio and candidate recordings are never publicly reachable; the Worker streams them only to authenticated sessions (or teacher keys).
- Correct answers and transcripts never leave the server before an attempt is completed.

## License

Public domain (Unlicense) — see [LICENSE](LICENSE).
