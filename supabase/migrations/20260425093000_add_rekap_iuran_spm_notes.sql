create table if not exists public.rekap_iuran_spm_notes (
  id bigserial primary key,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  no_spm text not null default '',
  created_by_user_id uuid null,
  created_by_role text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_rekap_iuran_spm_notes_period
on public.rekap_iuran_spm_notes(period_year, period_month, created_at desc);

alter table public.rekap_iuran_spm_notes enable row level security;

drop policy if exists "rekap_iuran_spm_notes_admin_read" on public.rekap_iuran_spm_notes;
create policy "rekap_iuran_spm_notes_admin_read" on public.rekap_iuran_spm_notes
for select
using (public.current_app_role() = 'admin');

drop policy if exists "rekap_iuran_spm_notes_bendahara_read" on public.rekap_iuran_spm_notes;
create policy "rekap_iuran_spm_notes_bendahara_read" on public.rekap_iuran_spm_notes
for select
using (public.current_app_role() = 'bendahara');

drop policy if exists "rekap_iuran_spm_notes_admin_insert" on public.rekap_iuran_spm_notes;
create policy "rekap_iuran_spm_notes_admin_insert" on public.rekap_iuran_spm_notes
for insert
with check (
  public.current_app_role() = 'admin'
  and created_by_user_id = auth.uid()
);