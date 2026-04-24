create or replace function public.approve_spm(p_spm_id text)
returns public.spm_documents
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  role_from_jwt text := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''));
  role_from_db text;
  effective_role text;
  updated_row public.spm_documents;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select lower(
    coalesce(
      u.raw_app_meta_data ->> 'role',
      u.raw_user_meta_data ->> 'role',
      ''
    )
  )
  into role_from_db
  from auth.users u
  where u.id = current_user_id;

  effective_role := coalesce(nullif(role_from_db, ''), role_from_jwt, '');

  if effective_role = 'bendahara' then
    update public.spm_documents
    set
      status = 'disetujui_bendahara',
      approved_bendahara_at = now(),
      approved_bendahara_user_id = current_user_id,
      updated_at = now()
    where id = p_spm_id and status = 'draft'
    returning * into updated_row;
  elsif effective_role = 'ketua' then
    update public.spm_documents
    set
      status = 'disetujui_ketua',
      approved_ketua_at = now(),
      approved_ketua_user_id = current_user_id,
      updated_at = now()
    where id = p_spm_id and status = 'disetujui_bendahara'
    returning * into updated_row;
  else
    raise exception 'Role tidak diizinkan untuk menyetujui SPM (role=%)', effective_role;
  end if;

  if updated_row.id is null then
    raise exception 'SPM tidak ditemukan atau status tidak valid untuk disetujui';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.approve_spm(text) from public;
grant execute on function public.approve_spm(text) to authenticated;