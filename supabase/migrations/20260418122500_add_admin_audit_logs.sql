create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_actor on public.admin_audit_logs(actor_user_id);

alter table public.admin_audit_logs enable row level security;

create policy "admin_audit_logs_admin_read" on public.admin_audit_logs
for select
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create policy "admin_audit_logs_admin_insert" on public.admin_audit_logs
for insert
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
