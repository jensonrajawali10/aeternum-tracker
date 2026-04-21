# Frequent crons — GitHub Actions setup

Vercel Hobby caps cron jobs at **once per day**. The audit fixes require
`check-alerts` to run every 15 minutes and `hot-news` to run every 3 hours.

Vercel's `vercel.json` keeps the **daily snapshot only** (fits Hobby).
The frequent crons run from GitHub Actions and curl our Bearer-protected
endpoints on the live domain.

## One-time setup

GitHub CLI's default OAuth scope doesn't allow pushing `.github/workflows/*`,
so this workflow is checked in as a `.yml.reference` file. You need to
install it manually (one minute in the GitHub web UI).

### 1. Add the workflow via the GitHub web UI

1. Go to https://github.com/jensonrajawali10/aeternum-tracker
2. Click `Add file → Create new file`
3. Type the path: `.github/workflows/cron-frequent.yml`
4. Paste the contents of `scripts/cron-setup/cron-frequent.yml.reference`
5. Commit to `main`

### 2. Add the repo secret

Settings → Secrets and variables → Actions → **New repository secret**

- Name: `CRON_SECRET`
- Value: *(same value as the `CRON_SECRET` env var in Vercel)*

### 3. Add the repo variable

Same panel → Variables tab → **New repository variable**

- Name: `APP_URL`
- Value: `https://aeternum-tracker-neon.vercel.app`

### 4. Verify

Actions tab → `cron-frequent` → **Run workflow** (manual dispatch).
Watch the run log — it should POST to both endpoints and print HTTP 200.

## Why this architecture

- **Idempotent endpoints**: the backends dedup (news_id, alert_history
  natural key) so a double-fire (Vercel cron + GH Actions) is safe.
- **Free tier**: GH Actions allows 2000 min/month free on public repos.
  Each tick is ~5s, so 15-min cadence uses ~12 min/day.
- **No external vendor lock-in**: if you upgrade to Vercel Pro later,
  just move the schedules back into `vercel.json` and disable the
  workflow.
