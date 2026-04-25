-- Grant ketua read access equivalent to bendahara across reporting tables.

-- Core tables

drop policy if exists "members_ketua_read" on public.members;
create policy "members_ketua_read" on public.members
for select
using (public.current_app_role() = 'ketua');

drop policy if exists "incomes_ketua_read" on public.incomes;
create policy "incomes_ketua_read" on public.incomes
for select
using (public.current_app_role() = 'ketua');

drop policy if exists "saved_accounts_ketua_read" on public.saved_accounts;
create policy "saved_accounts_ketua_read" on public.saved_accounts
for select
using (public.current_app_role() = 'ketua');

drop policy if exists "spm_documents_ketua_read" on public.spm_documents;
create policy "spm_documents_ketua_read" on public.spm_documents
for select
using (public.current_app_role() = 'ketua');

drop policy if exists "spm_line_items_ketua_read" on public.spm_line_items;
create policy "spm_line_items_ketua_read" on public.spm_line_items
for select
using (public.current_app_role() = 'ketua');

drop policy if exists "manual_expenses_ketua_read" on public.manual_expenses;
create policy "manual_expenses_ketua_read" on public.manual_expenses
for select
using (public.current_app_role() = 'ketua');

-- Optional rekap tables (guarded if table exists)

do $$
begin
  if to_regclass('public.rekap_iuran_spm_notes') is not null then
    execute 'drop policy if exists "rekap_iuran_spm_notes_ketua_read" on public.rekap_iuran_spm_notes';
    execute 'create policy "rekap_iuran_spm_notes_ketua_read" on public.rekap_iuran_spm_notes for select using (public.current_app_role() = ''ketua'')';
  end if;

  if to_regclass('public.rekap_iuran_tabung_values') is not null then
    execute 'drop policy if exists "rekap_iuran_tabung_values_admin_select" on public.rekap_iuran_tabung_values';
    execute 'create policy "rekap_iuran_tabung_values_admin_select" on public.rekap_iuran_tabung_values for select using (public.current_app_role() in (''admin'', ''bendahara'', ''ketua''))';
  end if;
end
$$;