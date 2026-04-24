create table if not exists public.bank_reconciliations (
  id bigserial primary key,
  period_year int not null,
  period_month int null check (period_month between 1 and 12),
  saldo_awal numeric(14, 2) not null default 0,
  total_pemasukan numeric(14, 2) not null default 0,
  total_pengeluaran numeric(14, 2) not null default 0,
  saldo_buku numeric(14, 2) not null default 0,
  saldo_bank numeric(14, 2) not null default 0,
  selisih numeric(14, 2) not null default 0,
  notes text not null default '',
  created_by_user_id uuid null,
  created_by_role text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_bank_reconciliations_period
on public.bank_reconciliations(period_year, period_month, created_at desc);

alter table public.bank_reconciliations enable row level security;

drop policy if exists "bank_reconciliations_admin_read" on public.bank_reconciliations;
create policy "bank_reconciliations_admin_read" on public.bank_reconciliations
for select
using (public.current_app_role() = 'admin');

drop policy if exists "bank_reconciliations_bendahara_read" on public.bank_reconciliations;
create policy "bank_reconciliations_bendahara_read" on public.bank_reconciliations
for select
using (public.current_app_role() = 'bendahara');

drop policy if exists "bank_reconciliations_admin_insert" on public.bank_reconciliations;
create policy "bank_reconciliations_admin_insert" on public.bank_reconciliations
for insert
with check (
  public.current_app_role() = 'admin'
  and created_by_user_id = auth.uid()
);

drop policy if exists "bank_reconciliations_bendahara_insert" on public.bank_reconciliations;
create policy "bank_reconciliations_bendahara_insert" on public.bank_reconciliations
for insert
with check (
  public.current_app_role() = 'bendahara'
  and created_by_user_id = auth.uid()
);