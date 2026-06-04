# Cloudflare Deployment Guide

Vite React frontend + Cloudflare Worker API (`edt-api`) + D1 database (`edt-diagnostic`).

Recommended order: **database → vouchers → host frontend (get URL) → set CORS → deploy Worker → connect API → test**.

## What caused `Invalid uuid` / `databaseId`

Wrangler reads `database_id` from `wrangler.toml`. If it is still the placeholder `<D1_DATABASE_ID>`, every remote D1 command fails with **Invalid uuid [code: 7400]**.

This repo is configured to use database UUID:

`4c4685d5-4e7d-415f-8c50-61894219deb4`

If you recreate the database, run `npx wrangler d1 list`, copy the new UUID, and update **both** `wrangler.toml` and `worker/wrangler.toml`.

---

## Step 1 — Prerequisites

```powershell
cd "c:\Users\aaron\Desktop\Project-for-Dr-Yeung\2-Kevin-English-Diagnostic-Test-Platform"
npm install
npx wrangler login
npx wrangler whoami
```

You also need:

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough to start).
- Your project on **GitHub** (or GitLab) so Pages can build from git. If it is only on your PC, push it to a new GitHub repo first.

---

## Step 2 — D1 migrations (remote)

From the project root:

```powershell
npx wrangler d1 migrations apply edt-diagnostic --remote
```

Optional local check:

```powershell
npx wrangler d1 migrations apply edt-diagnostic --local
```

---

## Step 3 — Seed vouchers from `Evouchers.txt`

Do **not** commit `Evouchers.txt`. Generate a one-time SQL file and import:

```powershell
$codes = Get-Content ".\Evouchers.txt" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$values = ($codes | ForEach-Object { "('$_')" }) -join ",`n"
$sql = "INSERT OR IGNORE INTO vouchers (code) VALUES`n$values;"
$sql | Set-Content -Path ".\seed-vouchers.sql" -Encoding utf8 -NoNewline
npx wrangler d1 execute edt-diagnostic --remote --file=.\seed-vouchers.sql
Remove-Item .\seed-vouchers.sql
```

Verify:

```powershell
npx wrangler d1 execute edt-diagnostic --remote --command "SELECT COUNT(*) AS total FROM vouchers;"
```

---

## Step 4 — Host the frontend on Cloudflare Pages (get your site URL first)

Do this **before** setting `ALLOWED_ORIGIN`. The Worker must allow the exact URL where users open the app.

### 4.1 Push code to GitHub (if needed)

1. Create a repo on GitHub (e.g. `english-diagnostic-test-platform`).
2. Push this project (do not push `Evouchers.txt` — it is in `.gitignore`).

### 4.2 Create a Cloudflare Pages project

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**.
2. Click **Create** → **Pages** → **Connect to Git**.
3. Authorize GitHub and select your repository.
4. **Project name** — pick something short (e.g. `edt-diagnostic`). This becomes part of your default URL.

### 4.3 Build settings (first deployment)

On the setup screen, use:

| Setting | Value |
|--------|--------|
| **Production branch** | `main` (or your default branch) |
| **Framework preset** | None (or Vite if offered) |
| **Build command** | `npm run build --workspace=frontend` |
| **Build output directory** | `frontend/dist` |
| **Root directory** | `/` (repository root — where the root `package.json` lives) |

Click **Save and Deploy**. The first build may take a few minutes.

If the build fails, open the build log. Common fixes:

- **Node version** — Pages → **Settings** → **Environment variables** → add `NODE_VERSION` = `20` (or `22`), then retry deploy.
- **Missing dependencies** — ensure the repo includes root `package.json` and `package-lock.json` so `npm install` runs at the repo root.

### 4.4 Find your default `*.pages.dev` URL

After a successful deploy:

1. Go to **Workers & Pages** → your Pages project → **Deployments**.
2. Open the latest **Production** deployment.
3. Click **Visit** (or copy the URL shown). It looks like:

   `https://edt-diagnostic.pages.dev`

   (Your subdomain matches the **project name** you chose.)

**Write this down.** That full URL (scheme + host, **no** path, **no** trailing slash) is your **frontend origin**.

Example: if Visit opens `https://edt-diagnostic.pages.dev/`, your origin is:

```text
https://edt-diagnostic.pages.dev
```

Open the site in a browser. You should see the landing page. Voucher/API calls may still fail until Steps 5–6 — that is expected for now.

### 4.5 Optional — Custom domain (your own name)

Skip this if `*.pages.dev` is enough for now.

1. In the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter a hostname you control, e.g. `test.yourschool.edu.hk` or `edt.example.com`.
3. Cloudflare shows DNS records to add:
   - If the **domain is already on Cloudflare** (same account): confirm the CNAME/target Cloudflare suggests; often it auto-configures.
   - If the domain is **elsewhere**: at your DNS provider, add the CNAME record Cloudflare lists (usually pointing to `<project>.pages.dev`).
4. Wait until status is **Active** (can take minutes to hours for DNS).

Your production origin is then the **custom domain** URL, e.g.:

```text
https://test.yourschool.edu.hk
```

Use **one** canonical URL for `ALLOWED_ORIGIN` — whichever users will actually use (custom domain **or** `pages.dev`, not both unless you configure both later).

### 4.6 Checklist before Step 5

You should have:

- [ ] A working Pages deployment (site loads in the browser).
- [ ] One production origin string, e.g. `https://edt-diagnostic.pages.dev` or `https://test.yourschool.edu.hk`.
- [ ] No trailing slash on that string.

---

## Step 5 — Configure CORS and deploy the Worker

The API only accepts browser requests from origins listed in `ALLOWED_ORIGIN`. Set it to the URL from **Step 4.4 or 4.5**.

### 5.1 Edit both Wrangler config files

In **`wrangler.toml`** (repo root) and **`worker/wrangler.toml`**, change:

```toml
ALLOWED_ORIGIN = "http://localhost:5173"
```

to your real frontend origin, for example:

```toml
ALLOWED_ORIGIN = "https://edt-diagnostic.pages.dev"
```

or:

```toml
ALLOWED_ORIGIN = "https://test.yourschool.edu.hk"
```

Rules:

- Use `https://` (Pages always serves HTTPS).
- **No** trailing `/`.
- Must match the browser address bar exactly (including subdomain).

Keep `http://localhost:5173` only for local dev; for production you need the Pages (or custom) URL above.

### 5.2 Deploy the Worker

From the project root:

```powershell
npm run worker:deploy
```

Note the Worker URL in the output, e.g.:

```text
https://edt-api.<your-account-subdomain>.workers.dev
```

### 5.3 Test the API

```powershell
curl https://edt-api.<your-subdomain>.workers.dev/api/health
```

Expect JSON like `{"ok":true}`.

### 5.4 Connect the frontend to the API

The React app calls `/api/...`. Choose **one** approach:

#### Option A — Separate Worker URL (simplest to set up first)

1. Pages project → **Settings** → **Environment variables**.
2. For **Production** (and **Preview** if you test preview URLs), add:

   | Variable | Value |
   |----------|--------|
   | `VITE_API_BASE` | `https://edt-api.<your-subdomain>.workers.dev` |

   No trailing slash on the Worker URL.

3. **Deployments** → **Retry deployment** (or push a commit) so the frontend rebuilds with the variable.

Browsers will call the Worker on `workers.dev`; CORS is handled by `ALLOWED_ORIGIN` from Step 5.1.

#### Option B — Same origin (`/api` on the Pages hostname)

Leave `VITE_API_BASE` unset. In the dashboard, attach Worker `edt-api` so `/api/*` on your Pages site routes to the Worker (exact UI varies; see **Workers & Pages** → your project → **Settings** → Functions / routes).

`ALLOWED_ORIGIN` must still be your Pages (or custom) URL from Step 4.

---

## Step 6 — Smoke test

1. Open your production URL (Pages or custom domain).
2. Enter a voucher from `Evouchers.txt`.
3. Complete the test; in DevTools **Network**, confirm `/api/verify-voucher` and `/api/submit` return success (not CORS errors).
4. On the quiz screen, try to select/copy question text — it should be blocked.

If you see **CORS errors**: `ALLOWED_ORIGIN` does not match the tab URL — fix Step 5.1 and run `npm run worker:deploy` again.

If **404 on `/api`**: you need Option A (`VITE_API_BASE` + redeploy) or Option B routing.

---

## Local development

```powershell
npm run worker:dev
```

Second terminal:

```powershell
npm run dev
```

Frontend proxies `/api/*` to `http://127.0.0.1:8787`. Local `ALLOWED_ORIGIN` can stay `http://localhost:5173`.

Seed a local voucher:

```powershell
npx wrangler d1 execute edt-diagnostic --local --command "INSERT INTO vouchers (code) VALUES ('TEST-LOCAL-001');"
```

### CLI-only Pages deploy (no Git)

If you are not using Git integration yet:

```powershell
npm run build --workspace=frontend
npx wrangler pages deploy frontend/dist --project-name=edt-diagnostic
```

Wrangler prints a preview URL; for production, use the dashboard **Visit** link after promoting to production. You still need that URL for `ALLOWED_ORIGIN` in Step 5.

---

## Quiz copy protection

During the live test (`QuizScreen`), `QuestionCard` runs with `preventCopy`:

- CSS `user-select: none` on question content
- Blocks copy, cut, right-click context menu, and text selection start

Client-side deterrent only; not a substitute for access control.

---

## Security reminders

- Never commit `Evouchers.txt`, `seed-vouchers.sql`, or `.dev.vars`.
- Do not put voucher batches or API tokens in source control.
- Voucher codes are normalized to uppercase by the Worker.
