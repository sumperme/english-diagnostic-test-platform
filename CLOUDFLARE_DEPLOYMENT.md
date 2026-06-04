# Cloudflare Deployment Guide

Vite React frontend + Cloudflare Worker API + D1 database (`edt-diagnostic`).

**Your production URL (API):** `https://eng-diagnostic.tzy667.workers.dev`  
**GitHub repo:** `https://github.com/sumperme/english-diagnostic-test-platform`  
**Cloudflare Workers Builds project:** `english-diagnostic-test-platform` (deployed Worker name: `eng-diagnostic`)

---

## Progress checklist

Use this to track where you are. Steps marked **[done]** match work already completed in your account.


| Step | Task                                                 | Status                                          |
| ---- | ---------------------------------------------------- | ----------------------------------------------- |
| 1    | Prerequisites (`npm install`, `wrangler login`)      | **[done]**                                      |
| 2    | GitHub repo connected                                | **[done]**                                      |
| 3    | D1 database `edt-diagnostic` + ID in `wrangler.toml` | **[done]**                                      |
| 4    | Remote migrations (`0001_init.sql`)                  | **[done]**                                      |
| 5    | Seed vouchers from `Evouchers.txt`                   | **TODO** — run Step 3 below if not done         |
| 6    | Workers Builds: build + deploy API                   | **[done]** — `cd worker && npx wrangler deploy` |
| 7    | Cloudflare Access: allow students                    | **TODO** — Step 5 below                         |
| 8    | `ALLOWED_ORIGIN` → production URL                    | **[done]** — redeploy via push to `main`        |
| 9    | Serve React app on same URL (static assets)          | **TODO** — Step 7 below                         |
| 10   | End-to-end smoke test (voucher → quiz → submit)      | **TODO** — Step 8 below                         |


**Important:** Step 6 deployed the **API only**. The landing page and quiz are **not** on the Worker URL yet until Step 7. `/api/health` should work after Access is fixed.

---

## Architecture (what you have now)

```text
GitHub (main) → Cloudflare Workers Builds
                  ├─ Build:  npm run build  (frontend/dist + worker typecheck)
                  └─ Deploy: cd worker && npx wrangler deploy  →  eng-diagnostic Worker + D1

Browser → https://eng-diagnostic.tzy667.workers.dev
            ├─ /api/*     → Worker (voucher, submit)  ✅ deployed
            └─ /, /quiz…  → static files               ❌ not deployed yet (Step 7)
```

Optional later: separate **Cloudflare Pages** project for frontend only, with `VITE_API_BASE` pointing at the Worker URL (see [Alternative: Pages for frontend only](#alternative-pages-for-frontend-only)).

---

## Reference — D1 database ID

Wrangler reads `database_id` from `wrangler.toml`. Placeholder `<D1_DATABASE_ID>` causes **Invalid uuid [code: 7400]**.

Configured UUID:

`4c4685d5-4e7d-415f-8c50-61894219deb4`

Update **both** `wrangler.toml` and `worker/wrangler.toml` if you recreate the database (`npx wrangler d1 list`).

---

## Step 1 — Prerequisites [done]

```powershell
cd "c:\Users\aaron\Desktop\Project-for-Dr-Yeung\2-Kevin-English-Diagnostic-Test-Platform"
npm install
npx wrangler login
npx wrangler whoami
```

---

## Step 2 — D1 migrations (remote) [done]

```powershell
npx wrangler d1 migrations apply edt-diagnostic --remote
```

Local optional:

```powershell
npx wrangler d1 migrations apply edt-diagnostic --local
```

---

## Step 3 — Seed vouchers from `Evouchers.txt` [Done]

Do **not** commit `Evouchers.txt` (listed in `.gitignore`).

```powershell
$codes = Get-Content ".\Evouchers.txt" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$values = ($codes | ForEach-Object { "('$_')" }) -join ",`n"
$sql = "INSERT OR IGNORE INTO vouchers (code) VALUES`n$values;"
$sql | Set-Content -Path ".\seed-vouchers.sql" -Encoding utf8 -NoNewline
npx wrangler d1 execute edt-diagnostic --remote --file=.\seed-vouchers.sql
Remove-Item .\seed-vouchers.sql
npx wrangler d1 execute edt-diagnostic --remote --command "SELECT COUNT(*) AS total FROM vouchers;"
```

Expect **50** rows if all codes imported once.

---

## Step 4 — Workers Builds (Git) [done]

You used **Workers** → **Connect to Git**, not classic Pages. Keep these settings:


| Field                 | Value                                       |
| --------------------- | ------------------------------------------- |
| **Repository**        | `sumperme/english-diagnostic-test-platform` |
| **Production branch** | `main`                                      |
| **Project name**      | `english-diagnostic-test-platform`          |
| **Build command**     | `npm run build`                             |
| **Deploy command**    | `cd worker && npx wrangler deploy`          |
| **Path**              | `/` (repo root)                             |


### Build log expectations

- `npm run build` → builds `frontend/dist` and typechecks worker ✅  
- `cd worker && npx wrangler deploy` → uploads API Worker ✅  
- Warning: CI may rename Worker to `**eng-diagnostic`** (dashboard name) even if `wrangler.toml` says `edt-api` — harmless; optional align `name` in config later.

### Do not use (causes failure)


| Deploy command                            | Problem                    |
| ----------------------------------------- | -------------------------- |
| `npx wrangler deploy` (from repo root)    | Workspace autoconfig error |
| Pages-only settings without Worker deploy | API not deployed           |


---

## Step 5 — Cloudflare Access (allow students) [Done]

Access currently can block everyone except allowed emails (e.g. only your Gmail). Students need a **public** or **domain-wide** policy.

1. Open [Cloudflare One](https://one.dash.cloudflare.com/) → **Access** → **Applications**.
2. Open the app protecting `**eng-diagnostic.tzy667.workers.dev`** (policy name e.g. `eng-diagnostic - Production`).
3. Edit policy → **Include** → change **Emails: [your@gmail.com](mailto:your@gmail.com)** to **Everyone**.
4. **Action** stays **Allow** → **Save policy**.

Team login domain (`english-diagnostic-platform.cloudflareaccess.com`) is only the sign-in page hostname — you do not change it for a public test.

**Test (incognito):**

```text
https://eng-diagnostic.tzy667.workers.dev/api/health
```

Expect `{"ok":true}` with **no** Cloudflare login screen.

**Alternative:** Delete the Access application for this hostname if you do not need Access at all.

---

## Step 6 — Set `ALLOWED_ORIGIN` and redeploy [done in repo]

Both **`wrangler.toml`** and **`worker/wrangler.toml`** are set to:

```toml
ALLOWED_ORIGIN = "https://eng-diagnostic.tzy667.workers.dev"
```

Rules: `https://`, no trailing `/`, must match the address bar exactly.

**Redeploy** so production picks up the change:

- **Push to `main`** (Workers Builds redeploys automatically), or  
- Local: `cd worker && npx wrangler deploy`

If you later host the UI on **Pages** or a custom domain, change `ALLOWED_ORIGIN` to that URL and redeploy again.

Optional: set `name = "eng-diagnostic"` in both wrangler files to match the dashboard and remove CI name warnings.

Local dev: `npm run dev` proxies `/api` to the worker on port 8787; you do not need production `ALLOWED_ORIGIN` for that flow.

---

## Step 7 — Serve the React app on the same URL [TODO]

Right now only the API is deployed. To show the landing page and quiz at `https://eng-diagnostic.tzy667.workers.dev/`, use **one** of the following.

### Option A — Full stack from repo root (recommended)

Requires a small `wrangler.toml` change (replace deprecated `pages_build_output_dir` with `[assets]`). After that, change Workers Builds **deploy command** to:

```text
npx wrangler deploy -c wrangler.toml
```

Root config should include (example):

```toml
name = "eng-diagnostic"
main = "worker/src/index.ts"

[assets]
directory = "frontend/dist"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

Build command stays `npm run build` so `frontend/dist` exists before deploy.

Ask in Agent mode to apply this config change in the repo if you want it committed for CI.

### Option B — Keep API deploy; add Cloudflare Pages for UI

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (same repo).
2. Build: `npm run build --workspace=frontend`, output: `frontend/dist`.
3. Pages env: `VITE_API_BASE` = `https://eng-diagnostic.tzy667.workers.dev`
4. Set `ALLOWED_ORIGIN` to your **Pages** URL (e.g. `https://english-diagnostic-test-platform.pages.dev`), not the Worker URL.
5. Redeploy Pages after env changes.

---

## Step 8 — Smoke test [TODO]

1. Open your **public** URL (Worker with assets, or Pages).
2. Confirm no Access login (incognito).
3. Enter a voucher from `Evouchers.txt`.
4. DevTools **Network**: `/api/verify-voucher` and `/api/submit` succeed (no CORS).
5. Quiz: question text should not be selectable/copyable.


| Symptom           | Fix                                        |
| ----------------- | ------------------------------------------ |
| Access login page | Step 5 — policy **Everyone** or delete app |
| CORS error        | Step 6 — `ALLOWED_ORIGIN` + redeploy       |
| 404 on `/`        | Step 7 — deploy static assets              |
| Invalid voucher   | Step 3 — seed D1                           |
| 401 voucher       | Code already used or typo                  |


---

## Workers Builds dashboard quick reference

**Settings → Build**


| Field          | Your value                                                   |
| -------------- | ------------------------------------------------------------ |
| Build command  | `npm run build`                                              |
| Deploy command | `cd worker && npx wrangler deploy` *(until Step 7 Option A)* |


**Visit URL after deploy**

`https://eng-diagnostic.tzy667.workers.dev`

---

## Alternative: Pages for frontend only

Use this if you prefer not to change root `wrangler.toml` yet.


| Component | Host                    | Build                                                  |
| --------- | ----------------------- | ------------------------------------------------------ |
| API       | Worker `eng-diagnostic` | `cd worker && npx wrangler deploy`                     |
| UI        | Pages project           | `npm run build --workspace=frontend` → `frontend/dist` |


Set `VITE_API_BASE` on Pages to the Worker URL. Set `ALLOWED_ORIGIN` on the Worker to the **Pages** origin.

---

## Local development

```powershell
npm run worker:dev
```

Second terminal:

```powershell
npm run dev
```

Frontend proxies `/api/*` to `http://127.0.0.1:8787` (same-origin via Vite proxy; no production CORS change needed locally).

```powershell
npx wrangler d1 execute edt-diagnostic --local --command "INSERT INTO vouchers (code) VALUES ('TEST-LOCAL-001');"
```

---

## Quiz copy protection

On `QuizScreen`, `QuestionCard` uses `preventCopy` (no select/copy on question text). Client-side only.

---

## Security reminders

- Never commit `Evouchers.txt`, `seed-vouchers.sql`, or `.dev.vars`.
- Do not put voucher batches or API tokens in source control.
- Voucher codes are normalized to uppercase by the Worker.

