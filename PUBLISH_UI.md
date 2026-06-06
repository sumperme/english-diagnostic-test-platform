# Publish UI changes (quick guide)

After you edit the frontend, run **one script**. It builds locally, commits, pushes to GitHub, and Cloudflare redeploys automatically.

**Production site:** https://eng-diagnostic.tzy667.workers.dev

---

## Every time you change the UI

From the project root in PowerShell:

```powershell
cd "c:\Users\aaron\Desktop\Project-for-Dr-Yeung\2-Kevin-English-Diagnostic-Test-Platform"
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
Read 5 files from the assets directory .../frontend/dist
env.ASSETS    Assets
```

### 4. If Cloudflare build fails

1. Open the failed deployment → read the **build log**
2. Fix the error locally, run `.\scripts\publish-ui.ps1` again
3. Or **Retry deployment** in the dashboard if it was a transient error

| Log error | Fix |
|-----------|-----|
| TypeScript / Vite build failed | Fix code; script catches this locally first |
| `Invalid uuid` on D1 | Do not change `database_id` in wrangler unless recreating D1 |
| Workspace autoconfig error | Deploy command must be `npx wrangler deploy -c wrangler.toml` |

### 5. If the site looks unchanged

- Hard refresh: `Ctrl+Shift+R` or incognito
- Confirm Cloudflare deployment **finished** (not still building)
- Confirm you pushed to **`main`** (production branch)

### 6. If you changed the database schema (D1 migrations)

UI publish does **not** apply D1 migrations automatically. After a migration is merged to `main`, run once:

```powershell
npx wrangler d1 migrations apply edt-diagnostic --remote -c wrangler.toml
```

For local preview, migrations run automatically via `local-preview.ps1`.

### 7. Admin page (`/admin`)

Production admin: https://eng-diagnostic.tzy667.workers.dev/admin

Local admin (after `local-preview.ps1`): http://localhost:5173/admin

Password is set in `wrangler.toml` as `ADMIN_PASSWORD` (default documented in deployment guide). Admin changes (voucher groups, metadata) use the **remote** D1 database — not the local one used during preview.

---

## What the script never commits

These stay local and are skipped by `publish-ui.ps1`:

- `Evouchers.txt`
- `seed-vouchers.sql`
- `scripts/local-preview.ps1` (local dev helper)
- `frontend/dist/` (built on Cloudflare during deploy)
- `.dev.vars`, `.wrangler/`, `.cursor/`, `Client_Feedback/`

These **can** be committed when changed: `PUBLISH_UI.md`, `scripts/publish-ui.ps1`, worker/frontend code, `migrations/`.

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

1. Apply local D1 migrations
2. Seed vouchers from `Evouchers.txt` into the **local** database
3. Start `npm run worker:dev` (Terminal 1)
4. Start `npm run dev` (Terminal 2)
5. Open http://localhost:5173

Use any code from `Evouchers.txt` (e.g. `4K2M-9R7T-1F5P`). Vite proxies `/api/*` to `http://127.0.0.1:8787`.

Admin UI locally: http://localhost:5173/admin (same `ADMIN_PASSWORD` as production).

Options:

| Command | When to use |
|---------|-------------|
| `.\scripts\local-preview.ps1 -SkipSeed` | DB already seeded; just restart servers |

---

## Full setup reference

Initial Cloudflare/Git/D1 setup: [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)
