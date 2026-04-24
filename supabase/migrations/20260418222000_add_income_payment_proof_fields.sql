alter table public.incomes
  add column if not exists proof_url text null,
  add column if not exists proof_file_id text null,
  add column if not exists proof_file_name text null;