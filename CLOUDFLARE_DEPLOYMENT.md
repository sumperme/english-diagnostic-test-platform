# Cloudflare Deployment Guide

Vite React frontend + Cloudflare Worker API + D1 database (`edt-diagnostic`).

**Production URL:** https://eng-diagnostic.tzy667.workers.dev  
**GitHub repo:** https://github.com/sumperme/english-diagnostic-test-platform  
**Cloudflare Worker:** `eng-diagnostic` (Workers Builds on `main`)

---

## Initial setup — complete

All one-time setup steps are done.


| Step | Task | Status |
| ---- | ---- | ------ |
| 1 | Prerequisites (`npm install`, `wrangler login`) | **[done]** |
| 2 | GitHub repo connected | **[done]** |
| 3 | D1 database + ID in `wrangler.toml` | **[done]** |
| 4 | Remote migrations | **[done]** |
| 5 | Vouchers seeded from `Evouchers.txt` | **[done]** |
| 6 | Workers Builds (Git) | **[done]** |
| 7 | Cloudflare Access (Everyone) | **[done]** |
| 8 | `ALLOWED_ORIGIN` production URL | **[done]** |
| 9 | React app + API on same URL (`ASSETS`) | **[done]** |
| 10 | End-to-end smoke test | **[done]** |

---

## Day-to-day — publish UI changes

Whenever you change the frontend, run:

```powershell
.\scripts\publish-ui.ps1
```

or:

```powershell
npm run publish:ui
```

That script builds locally, commits, and pushes to `main`. Cloudflare redeploys automatically.

**Short manual steps after each run:** wait for Cloudflare deployment Success → verify in incognito.

Full instructions: **[PUBLISH_UI.md](PUBLISH_UI.md)**

---

## Architecture

```text
You edit UI → publish-ui.ps1 → git push main → Cloudflare Workers Builds
                    │                              ├─ npm run build
                    │                              └─ npx wrangler deploy -c wrangler.toml
                    └─ local build check (optional)

https://eng-diagnostic.tzy667.workers.dev
  ├─ /api/*  → Worker (voucher, submit)
  └─ /*      → frontend/dist (React SPA via ASSETS)
```

---

## Workers Builds settings (do not change)

| Field | Value |
| ----- | ----- |
| Repository | `sumperme/english-diagnostic-test-platform` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy -c wrangler.toml` |
| Root directory | `/` |

Good deploy log includes `Read 5 files from the assets directory` and binding `env.ASSETS`.

---

## Reference — D1 database

UUID: `4c4685d5-4e7d-415f-8c50-61894219deb4`

In both `wrangler.toml` and `worker/wrangler.toml`. List databases: `npx wrangler d1 list`.

### Re-seed vouchers (rare)

```powershell
$codes = Get-Content ".\Evouchers.txt" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$values = ($codes | ForEach-Object { "('$_')" }) -join ",`n"
$sql = "INSERT OR IGNORE INTO vouchers (code) VALUES`n$values;"
$sql | Set-Content -Path ".\seed-vouchers.sql" -Encoding utf8 -NoNewline
npx wrangler d1 execute edt-diagnostic --remote --file=.\seed-vouchers.sql
Remove-Item .\seed-vouchers.sql
```

---

## Root `wrangler.toml` (production)

```toml
name = "eng-diagnostic"
main = "worker/src/index.ts"

[assets]
directory = "./frontend/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[vars]
ALLOWED_ORIGIN = "https://eng-diagnostic.tzy667.workers.dev"
```

Worker serves non-`/api/` paths via `env.ASSETS.fetch()`.

---

## Troubleshooting


| Symptom | Fix |
| ------- | --- |
| Access login page | Cloudflare One → Access → policy **Everyone** |
| CORS error | `ALLOWED_ORIGIN` must match browser URL; push + redeploy |
| `{"error":"Not found"}` on `/` | Redeploy; log must show `env.ASSETS` |
| UI not updated | Wait for Cloudflare Success; incognito / hard refresh |
| Invalid voucher | Re-seed D1 or check code not already used |
| Push failed | GitHub login — see [PUBLISH_UI.md](PUBLISH_UI.md) |
| Build failed on Cloudflare | Fix locally; `npm run build`; publish again |

### Emergency local deploy (skip CI)

```powershell
npx wrangler login   # once, if needed
npm run build
npm run deploy
```

---

## Local development

```powershell
npm run worker:dev
```

Second terminal:

```powershell
npm run dev
```

Open http://localhost:5173. API proxied to `http://127.0.0.1:8787`.

```powershell
npx wrangler d1 execute edt-diagnostic --local --command "INSERT INTO vouchers (code) VALUES ('TEST-LOCAL-001');"
```

---

## Security reminders

- Never commit `Evouchers.txt`, `seed-vouchers.sql`, or `.dev.vars`.
- Voucher codes are normalized to uppercase by the Worker.
- Quiz copy protection is client-side only (`preventCopy` on `QuestionCard`).
