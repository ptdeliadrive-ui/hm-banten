create table if not exists public.spm_change_logs (
  id bigserial primary key,
  spm_id text not null,
  spm_number text not null,
  action text not null check (action in ('edit', 'delete')),
  reason text not null check (char_length(trim(reason)) >= 5),
  actor_user_id uuid not null,
  actor_role text not null,
  before_data jsonb null,
  after_data jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_spm_change_logs_spm_id on public.spm_change_logs(spm_id);
create index if not exists idx_spm_change_logs_created_at on public.spm_change_logs(created_at desc);

alter table public.spm_change_logs enable row level security;

drop policy if exists "spm_change_logs_admin_read" on public.spm_change_logs;
create policy "spm_change_logs_admin_read" on public.spm_change_logs
for select
using (public.current_app_role() = 'admin');

drop policy if exists "spm_change_logs_admin_insert" on public.spm_change_logs;
create policy "spm_change_logs_admin_insert" on public.spm_change_logs
for insert
with check (
  public.current_app_role() = 'admin'
  and actor_user_id = auth.uid()
);