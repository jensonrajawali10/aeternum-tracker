# Decision Memos QA test plan

Scope: `decision_memos` table + `/api/memos` + `/memos` UI + Sidebar/Notes wiring.
Run order: top-to-bottom in a single review pass, after both teammates report complete.
Live URL: https://aeternum-tracker-neon.vercel.app

## Pre-deploy code review

### Backend — migration
- [ ] `supabase/migrations/<ts>_decision_memos.sql` exists, timestamp prefix matches repo convention, file name ends `_decision_memos.sql`
- [ ] `create table decision_memos` with `id uuid primary key default gen_random_uuid()`
- [ ] `user_id uuid not null references auth.users(id) on delete cascade`
- [ ] `decided_at date not null` (date, not timestamptz — matches brief)
- [ ] `decision`, `why`, `expected_outcome`, `invalidation` are all `text not null`
- [ ] `linked_ticker text` nullable, `linked_book text` nullable, `realized_outcome text` nullable, `realized_at timestamptz` nullable
- [ ] `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- [ ] `linked_book` CHECK constraint restricts to `('investing','idx_trading','crypto_trading','firm')` (and allows NULL)
- [ ] `alter table decision_memos enable row level security`
- [ ] Four RLS policies present: select / insert / update / delete, each gated on `auth.uid() = user_id`
- [ ] Index `decision_memos_user_decided_at_idx` on `(user_id, decided_at desc)`
- [ ] `updated_at` trigger present (re-uses existing `set_updated_at()` helper if repo has one, otherwise defines it)
- [ ] No `drop table` / destructive ops in the migration body
- [ ] Migration applied to live project — confirm via Supabase MCP `execute_sql` against `information_schema.columns where table_name = 'decision_memos'` and `pg_policies where tablename = 'decision_memos'`

### Backend — API routes
- [ ] `app/api/memos/route.ts` and `app/api/memos/[id]/route.ts` both export `export const dynamic = 'force-dynamic'`
- [ ] Both routes auth-gate via `supabaseServer()` and return 401 when `auth.getUser()` has no user (matches existing route pattern in repo)
- [ ] `GET /api/memos` returns `{ memos: DecisionMemo[] }`, ordered `decided_at desc` then `created_at desc` as tiebreak
- [ ] `POST /api/memos` validates required fields (`decision`, `why`, `expected_outcome`, `invalidation`, `decided_at`), trims string fields, rejects empty post-trim with `400 { error: '<field> required' }`
- [ ] `POST` accepts optional `linked_ticker` (uppercased + trimmed) and `linked_book` (validated against the four allowed values, empty/null passes through as `null`)
- [ ] `POST` returns `201 { memo }` on success; uses `.insert(...).select().single()`
- [ ] `GET /api/memos/[id]` returns `200 { memo }` or `404 { error: 'not found' }` (RLS-filtered rows surface as PostgREST `PGRST116` → treated as 404, not 500)
- [ ] `PATCH /api/memos/[id]` supports partial updates of any user-editable column
- [ ] `PATCH` bumps `realized_at = now()` when `realized_outcome` becomes non-null and caller did not pass `realized_at`
- [ ] `PATCH` clears `realized_at` to null when `realized_outcome` is explicitly set to null/empty
- [ ] All DB calls use Supabase query builder — no raw `from(...).rpc('...')` with user-string interpolation, no template-string SQL
- [ ] No service-role client used in any user-facing route (only `supabaseServer()`)

### Frontend — pages and components
- [ ] `app/(app)/memos/page.tsx` is a server component, sets `export const dynamic = 'force-dynamic'`, renders `<TopHeader />` + `<MemosClient />`
- [ ] `MemosClient.tsx` is `'use client'`, uses SWR with key `/api/memos`, `refreshInterval: 60_000`, `revalidateOnFocus: true`
- [ ] `+ New memo` CTA opens `MemoForm` dialog using parent mount-on-open pattern (dialog only mounts when `open === true`) — no React 19 component-purity violations
- [ ] Dialog `onSuccess` calls `mutate('/api/memos')` and closes
- [ ] `MemosTable.tsx` columns: Decided / Decision (truncated to ~60 chars with title attr) / Book / Ticker / Status — in this order
- [ ] Status pill text: `Outcome recorded` if `realized_outcome` non-empty, else `Open` (matches existing pill component styling)
- [ ] Empty state copy is action-oriented (e.g. "No memos yet — log your first decision before you size the position.") not a generic "no data"
- [ ] `MemoForm.tsx` validates required fields client-side (`decision`, `why`, `expected_outcome`, `invalidation`, `decided_at`) before POSTing
- [ ] Book select includes empty option + the four allowed values (`investing` / `idx_trading` / `crypto_trading` / `firm`) with human-readable labels
- [ ] `decided_at` defaults to today in WIB (`Asia/Jakarta`) — re-uses existing date helper if one exists, no `new Date().toISOString().slice(0,10)` UTC bug
- [ ] `app/(app)/memos/[id]/page.tsx` fetches single memo server-side or via SWR, renders all static fields + `<RealizedOutcomeForm />`
- [ ] `RealizedOutcomeForm.tsx` has read mode and edit mode, PATCHes `/api/memos/[id]`, mutates `/api/memos` and `/api/memos/[id]` keys on success
- [ ] Long text fields render with `whitespace-pre-wrap` so newlines survive
- [ ] Linked ticker (when present) renders mono / uppercase to match other ticker UIs in the repo

### Frontend — wiring
- [ ] `components/Sidebar.tsx` — `Memos` entry added inside the Firm group, positioned between `Journal` and `Risk`, using same icon convention as existing siblings
- [ ] Sidebar active-state highlights when `pathname.startsWith('/memos')`
- [ ] `app/(app)/books/[book]/notes/page.tsx` — old "decision memos are on the roadmap" copy is gone, replaced with text + link pointing to `/memos`
- [ ] Repo-wide grep for `coming soon`, `on the roadmap`, `next iteration`, `TODO: memos` returns no leftover hits referencing memos

### Type safety + lint
- [ ] `pnpm tsc --noEmit` is clean
- [ ] `pnpm lint` (eslint) is clean — no new errors; pre-existing warnings tolerated
- [ ] `DecisionMemo` TypeScript type defined once in `lib/types/` (or wherever the repo keeps shared types) and imported by both API routes and frontend components — no duplicated interface drift
- [ ] No `any` in API request/response shapes; `unknown` + narrowing acceptable
- [ ] Build succeeds locally: `pnpm build` exits 0

## Post-deploy live-site verification
(Run after orchestrator deploys via vercel CLI. Live URL: https://aeternum-tracker-neon.vercel.app)

### Smoke
- [ ] `/memos` route loads, no 404 / 500 / blank page
- [ ] Sidebar shows `Memos` in Firm group, active state lights up on `/memos`
- [ ] Page renders empty state on a fresh account, OR existing memos if seeded
- [ ] `+ New memo` button opens the dialog; `Esc` and backdrop click both close it

### Create flow
- [ ] Submit minimal valid memo (all required fields filled, no ticker, no book) → 201, dialog closes, list mutates and shows the new row at the top
- [ ] Submit with empty `why` → 400, inline error shown next to the `why` field, dialog stays open
- [ ] Submit with `linked_book` set to a valid value → row shows the BookBadge in the Book column
- [ ] `linked_ticker` is optional and accepts empty
- [ ] `decided_at` accepts a back-dated value (e.g. 30 days ago) and the row sorts in correctly
- [ ] Network tab: POST request body has trimmed strings (no leading/trailing whitespace) and `linked_ticker` upper-cased

### Read flow
- [ ] Click a row → `/memos/[id]` resolves, no 404
- [ ] All fields render correctly; multi-line `why` / `expected_outcome` / `invalidation` preserve newlines
- [ ] BookBadge renders if `linked_book` set, hidden if null
- [ ] Linked ticker renders mono/uppercase if set, hidden if null
- [ ] `decided_at` displayed in WIB (matches the rest of the app's date formatting)

### Realized-outcome flow
- [ ] Empty `realized_outcome` shows "Outcome not yet recorded" copy + textarea (edit mode by default)
- [ ] Save with non-empty outcome → PATCH 200, swaps to read mode, shows the outcome text + `Recorded <date WIB>`
- [ ] Click `Edit` → form returns to edit mode pre-filled, `Save` updates, `Cancel` reverts to last saved value
- [ ] Navigate back to `/memos` → row's Status pill flipped to `Outcome recorded` after the 60s SWR refresh (or immediately if mutate fired)
- [ ] Clearing outcome back to empty (if supported) clears `realized_at` too

### Auth + RLS
- [ ] Unauthed `GET /api/memos` (curl with no cookie / fresh incognito) → 401
- [ ] Unauthed `POST /api/memos` → 401
- [ ] Create a memo as User A; sign in as User B and visit `/api/memos/<A-memo-id>` → 404 (not 200, not the row, not 500)
- [ ] User B's `GET /api/memos` does not include any of User A's memos
- [ ] User B `PATCH` against User A's memo id → 404

### Mobile (360px viewport via DevTools)
- [ ] `/memos` table either horizontally scrolls inside its container or wraps cleanly — no horizontal page scroll
- [ ] `MemoForm` dialog fits viewport, content scrolls vertically inside it, Save button reachable without keyboard tricks
- [ ] Sidebar drawer opens via hamburger, `Memos` link is tappable, routes correctly, drawer closes on navigation
- [ ] Detail page (`/memos/[id]`) layout doesn't overflow; long text wraps

### Notes-tab fix
- [ ] Visit `/books/investing/notes` — copy now points to `/memos` and the link navigates correctly
- [ ] Same check on `/books/idx_trading/notes`, `/books/crypto_trading/notes`, `/books/firm/notes`
- [ ] Old "on the roadmap" / "coming soon" wording is gone from all four book notes tabs

## Bugs / smells log
(Empty for now — populated during the actual review pass.)

- 
