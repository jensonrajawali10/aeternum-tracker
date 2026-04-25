# Decision Memos QA report

- Feature: Decision Memos (pre-commitment journal + retroactive outcome)
- Commit: 2d621f3 — `Decision Memos: pre-commitment journal feature`
- Deploy URL: https://aeternum-tracker-neon.vercel.app
- Review date: 2026-04-26

## Pre-deploy code review

### Backend — migration
- [x] `supabase/migrations/20260425232421_decision_memos.sql` exists, naming convention matches
- [x] `create table decision_memos` with `id uuid primary key default gen_random_uuid()`
- [x] `user_id uuid not null references auth.users(id) on delete cascade`
- [x] `decided_at date not null`
- [x] `decision`, `why`, `expected_outcome`, `invalidation` are `text not null`
- [x] `linked_ticker`, `linked_book`, `realized_outcome`, `realized_at` nullable as required
- [x] `created_at` / `updated_at` `timestamptz not null default now()`
- [x] `linked_book` CHECK restricts to `('investing','idx_trading','crypto_trading','firm')` (NULL allowed)
- [x] `enable row level security`
- [x] Four RLS policies present (select / insert / update / delete), each gated on `auth.uid() = user_id`
- [~] Index on `(user_id, decided_at desc)` — present, named `idx_decision_memos_user_decided`. Functionally identical, naming drift only.
- [x] `set_updated_at()` helper (re-)defined and `trg_decision_memos_set_updated_at` trigger wired
- [x] Migration applied — Supabase MCP confirms 13 cols match exactly, 4 policies, index, trigger present. Project `fvvuddlksvxcqctrzygi` (`ap-southeast-1`).

### Backend — API routes
- [x] Both routes export `dynamic = 'force-dynamic'` and `runtime = 'nodejs'`
- [x] Both auth-gate via `supabaseServer()` + `auth.getUser()` → 401. Middleware also returns 401 for unauthed `/api/*`.
- [~] `GET /api/memos` returns `{ memos: DecisionMemo[] }` ordered `decided_at desc` only — **missing `created_at desc` tiebreak** (bug #3).
- [x] `POST /api/memos` Zod-validates required fields, trims, rejects empty post-trim with 400
- [~] `POST` accepts optional `linked_ticker` / `linked_book`. **Does NOT uppercase `linked_ticker`** server-side (bug #2).
- [x] `POST` returns `201 { memo }`
- [x] `GET /api/memos/[id]` → `200 { memo }` or `404 { error: 'not_found' }`. RLS-filtered rows surface as `data === null` → 404, not 500.
- [x] `PATCH /api/memos/[id]` supports partial updates of every user-editable column
- [x] `PATCH` stamps `realized_at = now()` when `realized_outcome` becomes non-null and caller didn't pass `realized_at`
- [x] `PATCH` clears `realized_at` to null when `realized_outcome` set to null/empty
- [x] All DB calls use Supabase query builder; no rpc string interp, no SQL templates
- [x] No service-role client; only `supabaseServer()` (anon key + cookie session, RLS enforced)

### Frontend — pages and components
- [x] `app/(app)/memos/page.tsx` server component, `dynamic = 'force-dynamic'`, renders TopHeader + Panel + MemosClient
- [~] `MemosClient.tsx` doesn't explicitly set `revalidateOnFocus: true`. Default is true so it works (bug #4, cosmetic).
- [x] `+ New memo` opens MemoForm via parent mount-on-open — fresh mount, lazy useState initialiser, React 19 strict-purity safe
- [x] `onSuccess` calls `mutate()` and closes
- [x] MemosTable cols: Decided / Decision (truncated 80ch) / Book / Ticker / Status
- [~] **No `title` attr on the truncated decision cell** (bug #6)
- [x] Status pill: `Outcome recorded` (green) when `realized_outcome` non-empty after trim, else `Open` (muted)
- [x] Empty state copy is action-oriented
- [x] MemoForm validates client-side (≥3 chars trimmed on all four narrative fields + decidedAt 10 chars)
- [x] Book select includes empty + four allowed values with human labels
- [x] `decided_at` defaults to today in WIB via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })`. No UTC slice bug. Wrapped in lazy useState.
- [x] `app/(app)/memos/[id]/page.tsx` fetches single memo via `supabaseServer()` (RLS-scoped), renders all fields + RealizedOutcomeForm, `notFound()` on missing/error
- [~] RealizedOutcomeForm uses `router.refresh()` not `mutate('/api/memos')`. Detail re-renders, but `/api/memos` cache stale up to 60s on back-nav (bug #5).
- [x] All long text uses `whitespace-pre-wrap` — newlines survive

### Frontend — wiring
- [~] Sidebar Firm-group order: Command Center / Capital / Firm Risk / Journal / Memos. Plan wanted between Journal and Firm Risk (bug #10, cosmetic).
- [x] Active state covers `pathname === '/memos'` and `pathname.startsWith('/memos/')`
- [x] Notes-tab page — old "on the roadmap" copy gone; replaced with link to /memos
- [x] Repo-wide grep: no leftover `coming soon` / `on the roadmap` / `next iteration` referencing memos

### Type safety + lint
- [x] `pnpm exec tsc --noEmit` — clean
- [x] `pnpm exec eslint ...` — clean
- [~] `DecisionMemo` lives in `components/memos/MemosTable.tsx`, not `lib/types.ts` (bug #7, cosmetic)
- [x] No `any` in API request/response shapes — Zod + typed `MemoUpdate`

## Post-deploy live-site verification

### Smoke
- [x] `/memos` reachable — `curl -I https://aeternum-tracker-neon.vercel.app/memos` returns `307` redirect to `/login?redirect=%2Fmemos`. Not 404, not 500.
- [ ] Sidebar shows Memos in Firm group, active on /memos — manual verification (auth required)
- [ ] Empty state on fresh account / existing memos render — manual
- [ ] `+ New memo` opens dialog; Esc + backdrop click close — manual

### Create flow
- [ ] Minimal valid memo → 201, dialog closes, list mutates — manual
- [ ] Empty `why` → 400 + inline error — manual
- [ ] linked_book set → BookBadge in column — manual **(will fail for `firm` until bug #1 fix)**
- [ ] linked_ticker accepts empty — manual
- [ ] Back-dated decided_at sorts correctly — manual
- [ ] POST body has trimmed strings + uppercased ticker — manual **(will fail until bug #2 fix)**

### Read flow
- [ ] Row click → /memos/[id] resolves — manual
- [ ] Multi-line fields preserve newlines — manual
- [ ] BookBadge renders if linked_book set — manual **(will render broken for `firm` until bug #1 fix)**
- [ ] Linked ticker mono — manual
- [ ] decided_at displayed in WIB — manual

### Realized-outcome flow
- [ ] Empty outcome → "not yet recorded" copy + textarea — manual
- [ ] Save → PATCH 200, swap to read mode, "Recorded <date WIB>" — manual
- [ ] Edit / Save / Cancel cycle — manual
- [ ] Back to /memos → Status pill flipped to "Outcome recorded" — manual **(stale up to 60s until bug #5 fix)**
- [ ] Clearing outcome clears realized_at — backend supports it, UI has no clear button (bug #9)

### Auth + RLS
- [x] Unauthed GET /api/memos → 401 (middleware verified)
- [x] Unauthed POST /api/memos → 401 (same gate)
- [ ] Cross-user reads → 404 — manual two-account check (RLS policies confirmed)
- [ ] User B's list excludes User A's memos — manual
- [ ] User B PATCH against User A's memo → 404 — manual

### Mobile (360px)
- [ ] /memos table scrolls inside container — manual (overflow-x-auto wrapper looks correct)
- [ ] MemoForm dialog fits viewport, body scrolls vertically — manual (max-h-[72vh] + overflow-y-auto, looks correct)
- [ ] Sidebar drawer + Memos link — manual
- [ ] Detail page no overflow, long text wraps — manual (whitespace-pre-wrap on every long-text panel)

### Notes-tab fix
- [ ] /books/investing/notes points to /memos — manual
- [ ] /books/idx-trading/notes, /books/crypto-trading/notes — manual
- [x] Old "on the roadmap" wording is gone

## Bugs / smells log

1. **`linked_book = "firm"` breaks BookBadge** — `lib/types.ts:2` defines `BookType` without `"firm"`. Migration CHECK + MemoForm both allow `"firm"`. `BookBadge` renders broken styling + wrong label for firm-tagged memos.
2. **`linked_ticker` not uppercased** — `app/api/memos/route.ts:18-24` only trims; MemoForm only trims. Lower-case input lands lower-case.
3. **GET ordering missing `created_at` tiebreak** — `app/api/memos/route.ts:48` orders by `decided_at desc` only. Two memos same day are arbitrary.
4. **MemosClient SWR config doesn't set revalidateOnFocus explicitly** — works via default, plan asked for explicit. Cosmetic.
5. **RealizedOutcomeForm uses `router.refresh()` not SWR mutate** — `/api/memos` cache stale up to 60s on back-nav after recording an outcome.
6. **No `title` attr on truncated decision cell** — full text not visible on hover.
7. **`DecisionMemo` lives in `components/memos/MemosTable.tsx`, not `lib/types.ts`** — off-pattern vs `Trade` / `OpenPosition`. Cosmetic.
8. **Index name drift** — `idx_decision_memos_user_decided` vs plan's `decision_memos_user_decided_at_idx`. Identical functionality. No action.
9. **Realized-outcome can't be cleared from UI** — backend supports clearing (PATCH `{ realized_outcome: null }`), no UI button. Minor UX gap.
10. **Sidebar Firm-group order** — Memos at end vs plan asking between Journal and Firm Risk. Cosmetic.

## Next steps for Jenson

The unauthenticated edge is verified. Signed-in flow is up to you — fresh incognito at the deploy URL:

- **Smoke**: log in, click Memos in the Firm group, confirm empty-state copy + `+ New memo` opens. Esc + backdrop both close.
- **Create flow**: minimal memo → 201 + row at top. Empty `why` → 400. Submit with `linked_book = firm` and **eyeball the BookBadge** — bug #1 below.
- **Realized-outcome flow**: open a memo, record an outcome, save. Confirm "Recorded <date WIB>". Navigate back to /memos and watch Status — bug #5 below until fix.
- **RLS cross-user check**: sign out, sign in as a second account. Devtools console: `await fetch('/api/memos/<uuid-from-A>').then(r => [r.status, r.json()])`. Expect 404.
- **Mobile pass**: DevTools 360px. Walk same flows; watch table overflow + dialog overflow (Save must stay reachable).
- **Ticker normalisation**: type lower-case ticker, confirm it's coerced upper-case post-fix.

## Recommendation

Bug #1 is a real regression for any firm-tagged memo. Bugs #2 / #3 / #5 / #6 are 1-5 line fixes worth bundling. Suggested follow-up commit:

> Decision Memos: firm BookBadge + ticker uppercase + outcome mutate

Everything else (typecheck, lint, schema, RLS, route reachability) is clean.
