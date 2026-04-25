-- supabase/migrations/20260425094500_add_rekap_iuran_tabung_values.sql

create table if not exists public.rekap_iuran_tabung_values (
  id bigserial primary key,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  member_id text not null,
  total_tabung numeric(14, 2) not null default 0,
  created_by_user_id uuid null,
  created_by_role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_rekap_iuran_tabung_values_period_member
on public.rekap_iuran_tabung_values(period_year, period_month, member_id);

create index if not exists idx_rekap_iuran_tabung_values_period
on public.rekap_iuran_tabung_values(period_year, period_month, created_at desc);

alter table public.rekap_iuran_tabung_values enable row level security;

drop policy if exists "rekap_iuran_tabung_values_admin_select" on public.rekap_iuran_tabung_values;
create policy "rekap_iuran_tabung_values_admin_select" on public.rekap_iuran_tabung_values
for select
using (public.current_app_role() in ('admin', 'bendahara'));

drop policy if exists "rekap_iuran_tabung_values_admin_insert" on public.rekap_iuran_tabung_values;
create policy "rekap_iuran_tabung_values_admin_insert" on public.rekap_iuran_tabung_values
for insert
with check (
  public.current_app_role() in ('admin', 'bendahara')
  and created_by_user_id = auth.uid()
);

drop policy if exists "rekap_iuran_tabung_values_admin_update" on public.rekap_iuran_tabung_values;
create policy "rekap_iuran_tabung_values_admin_update" on public.rekap_iuran_tabung_values
for update
using (
  public.current_app_role() in ('admin', 'bendahara')
  and created_by_user_id = auth.uid()
)
with check (
  public.current_app_role() in ('admin', 'bendahara')
  and created_by_user_id = auth.uid()
);

drop policy if exists "rekap_iuran_tabung_values_admin_delete" on public.rekap_iuran_tabung_values;
create policy "rekap_iuran_tabung_values_admin_delete" on public.rekap_iuran_tabung_values
for delete
using (
  public.current_app_role() in ('admin', 'bendahara')
  and created_by_user_id = auth.uid()
);
