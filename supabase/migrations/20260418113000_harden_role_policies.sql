-- Harden role-based access using JWT app_metadata.role

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

-- Remove permissive policies

drop policy if exists "Allow all for members" on public.members;
drop policy if exists "Allow all for incomes" on public.incomes;
drop policy if exists "Allow all for saved_accounts" on public.saved_accounts;
drop policy if exists "Allow all for spm_documents" on public.spm_documents;
drop policy if exists "Allow all for spm_line_items" on public.spm_line_items;
drop policy if exists "Allow all for manual_expenses" on public.manual_expenses;

-- MEMBERS
create policy "members_admin_full" on public.members
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "members_bendahara_read" on public.members
for select
using (public.current_app_role() = 'bendahara');

-- INCOMES
create policy "incomes_admin_full" on public.incomes
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "incomes_bendahara_read" on public.incomes
for select
using (public.current_app_role() = 'bendahara');

-- SAVED ACCOUNTS
create policy "saved_accounts_admin_full" on public.saved_accounts
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "saved_accounts_bendahara_read" on public.saved_accounts
for select
using (public.current_app_role() = 'bendahara');

-- SPM DOCUMENTS
create policy "spm_documents_admin_full" on public.spm_documents
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "spm_documents_bendahara_read" on public.spm_documents
for select
using (public.current_app_role() = 'bendahara');

-- SPM LINE ITEMS
create policy "spm_line_items_admin_full" on public.spm_line_items
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "spm_line_items_bendahara_read" on public.spm_line_items
for select
using (public.current_app_role() = 'bendahara');

-- MANUAL EXPENSES
create policy "manual_expenses_admin_full" on public.manual_expenses
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "manual_expenses_bendahara_read" on public.manual_expenses
for select
using (public.current_app_role() = 'bendahara');
