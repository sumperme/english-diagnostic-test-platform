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

---

## What the script never commits

These stay local (`.gitignore`):

- `Evouchers.txt`
- `frontend/dist/` (built on Cloudflare during deploy)
- `.cursor/`, `Client_Feedback/`

---

## Local preview before publishing

```powershell
npm run worker:dev
```

Second terminal:

```powershell
npm run dev
```

Open http://localhost:5173 — API proxied to the local worker.

---

## Full setup reference

Initial Cloudflare/Git/D1 setup: [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)
