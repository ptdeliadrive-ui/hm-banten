alter table public.spm_documents
  add column if not exists approved_bendahara_at timestamptz null,
  add column if not exists approved_bendahara_user_id uuid null,
  add column if not exists approved_ketua_at timestamptz null,
  add column if not exists approved_ketua_user_id uuid null;

update public.spm_documents
set
  status = 'disetujui_ketua',
  approved_bendahara_at = coalesce(approved_bendahara_at, updated_at, created_at),
  approved_ketua_at = coalesce(approved_ketua_at, updated_at, created_at)
where status = 'disetujui';

create or replace function public.approve_spm(p_spm_id text)
returns public.spm_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text := public.current_app_role();
  current_user_id uuid := auth.uid();
  updated_row public.spm_documents;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if current_role = 'bendahara' then
    update public.spm_documents
    set
      status = 'disetujui_bendahara',
      approved_bendahara_at = now(),
      approved_bendahara_user_id = current_user_id,
      updated_at = now()
    where id = p_spm_id and status = 'draft'
    returning * into updated_row;
  elsif current_role = 'ketua' then
    update public.spm_documents
    set
      status = 'disetujui_ketua',
      approved_ketua_at = now(),
      approved_ketua_user_id = current_user_id,
      updated_at = now()
    where id = p_spm_id and status = 'disetujui_bendahara'
    returning * into updated_row;
  else
    raise exception 'Role tidak diizinkan untuk menyetujui SPM';
  end if;

  if updated_row.id is null then
    raise exception 'SPM tidak ditemukan atau status tidak valid untuk disetujui';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.approve_spm(text) from public;
grant execute on function public.approve_spm(text) to authenticated;

create policy "spm_documents_ketua_read" on public.spm_documents
for select
using (public.current_app_role() = 'ketua');

create policy "spm_line_items_ketua_read" on public.spm_line_items
for select
using (public.current_app_role() = 'ketua');