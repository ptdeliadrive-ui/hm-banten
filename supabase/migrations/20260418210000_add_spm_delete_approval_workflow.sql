create table if not exists public.spm_delete_requests (
  id bigserial primary key,
  spm_id text not null,
  spm_number text not null,
  reason text not null check (char_length(trim(reason)) >= 5),
  requested_by_user_id uuid not null,
  requested_by_role text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by_user_id uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_spm_delete_requests_pending_unique
on public.spm_delete_requests(spm_id)
where status = 'pending';

create index if not exists idx_spm_delete_requests_status_created_at
on public.spm_delete_requests(status, created_at desc);

alter table public.spm_delete_requests enable row level security;

drop policy if exists "spm_delete_requests_admin_read" on public.spm_delete_requests;
create policy "spm_delete_requests_admin_read" on public.spm_delete_requests
for select
using (public.current_app_role() = 'admin');

drop policy if exists "spm_delete_requests_bendahara_read" on public.spm_delete_requests;
create policy "spm_delete_requests_bendahara_read" on public.spm_delete_requests
for select
using (public.current_app_role() = 'bendahara');

drop policy if exists "spm_delete_requests_admin_insert" on public.spm_delete_requests;
create policy "spm_delete_requests_admin_insert" on public.spm_delete_requests
for insert
with check (
  public.current_app_role() = 'admin'
  and requested_by_user_id = auth.uid()
  and requested_by_role = 'admin'
);

create or replace function public.approve_spm_delete_request(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_role text := lower(public.current_app_role());
  current_user_id uuid := auth.uid();
  req public.spm_delete_requests;
  target_spm public.spm_documents;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if current_role <> 'bendahara' then
    raise exception 'Hanya bendahara yang dapat menyetujui penghapusan SPM';
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