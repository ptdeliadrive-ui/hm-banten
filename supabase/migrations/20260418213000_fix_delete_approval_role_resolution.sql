create or replace function public.approve_spm_delete_request(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  role_from_jwt text := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''));
  role_from_db text;
  effective_role text;
  req public.spm_delete_requests;
  target_spm public.spm_documents;
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

  if effective_role <> 'bendahara' then
    raise exception 'Hanya bendahara yang dapat menyetujui penghapusan SPM (role=%)', effective_role;
  end if;

  select *
  into req
  from public.spm_delete_requests
  where id = p_request_id and status = 'pending'
  for update;

  if req.id is null then
    raise exception 'Permintaan penghapusan tidak ditemukan atau sudah diproses';
  end if;

  select *
  into target_spm
  from public.spm_documents
  where id = req.spm_id;

  if target_spm.id is null then
    update public.spm_delete_requests
    set
      status = 'rejected',
      approved_by_user_id = current_user_id,
      approved_at = now()
    where id = req.id;

    raise exception 'SPM target sudah tidak tersedia';
  end if;

  insert into public.spm_change_logs (
    spm_id,
    spm_number,
    action,
    reason,
    actor_user_id,
    actor_role,
    before_data,
    after_data
  ) values (
    target_spm.id,
    target_spm.nomor_spm,
    'delete',
    concat('Disetujui bendahara. Alasan admin: ', req.reason),
    current_user_id,
    'bendahara',
    to_jsonb(target_spm),
    null
  );

  delete from public.spm_documents
  where id = req.spm_id;

  update public.spm_delete_requests
  set
    status = 'approved',
    approved_by_user_id = current_user_id,
    approved_at = now()
  where id = req.id;
end;
$$;

revoke all on function public.approve_spm_delete_request(bigint) from public;
grant execute on function public.approve_spm_delete_request(bigint) to authenticated;