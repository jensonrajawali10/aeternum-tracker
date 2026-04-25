create table if not exists public.decision_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decided_at date not null,
  decision text not null,
  why text not null,
  expected_outcome text not null,
  invalidation text not null,
  linked_ticker text,
  linked_book text check (linked_book in ('investing','idx_trading','crypto_trading','firm')),
  realized_outcome text,
  realized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_decision_memos_user_decided
  on public.decision_memos (user_id, decided_at desc);

alter table public.decision_memos enable row level security;

drop policy if exists "own memos select" on public.decision_memos;
create policy "own memos select"
  on public.decision_memos
  for select
  using (auth.uid() = user_id);

drop policy if exists "own memos insert" on public.decision_memos;
create policy "own memos insert"
  on public.decision_memos
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "own memos update" on public.decision_memos;
create policy "own memos update"
  on public.decision_memos
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own memos delete" on public.decision_memos;
create policy "own memos delete"
  on public.decision_memos
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_decision_memos_set_updated_at on public.decision_memos;
create trigger trg_decision_memos_set_updated_at
  before update on public.decision_memos
  for each row execute function public.set_updated_at();

comment on table public.decision_memos is
  'Pre-commitment decision memos: why a position is being taken, expected outcome, what would invalidate the thesis. realized_outcome/realized_at are filled in after the fact for the post-mortem journal.';
