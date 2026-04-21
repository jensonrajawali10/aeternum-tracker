# Frequent crons — GitHub Actions setup

Vercel Hobby caps cron jobs at **once per day**. We need:
- `check-alerts` — every 5 min (price triggers)
- `hot-news?realtime=1` — every 5 min (20-min window, urgency=3, score≥85,
  "⚡ BREAKING" subject; fires the moment MSCI/FTSE/LQ45 rebalances, halts,
  Fed surprises, IDR breaks, or sovereign ratings hit the wire)
- `hot-news` — every 3 hours at :00 UTC (broad sweep for mid-urgency news)

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

- **Idempotent endpoints**: the backends dedup (`news_alert_sent` on
  `user_id,news_id`; alert_history natural key) so a double-fire is safe.
- **Realtime window without duplicate emails**: the 5-min cadence + 20-min
  `published` cutoff gives 4× overlap, so any feed lag up to 15 min still
  gets caught on a subsequent tick. The dedup table prevents double-sends.
- **Free tier**: GH Actions allows unlimited minutes on public repos.
  Each tick is ~8–12s, so 5-min cadence uses ~50 min/day — comfortably
  inside any quota.
- **No external vendor lock-in**: if you upgrade to Vercel Pro later,
  move the schedules back into `vercel.json` and disable the workflow.
