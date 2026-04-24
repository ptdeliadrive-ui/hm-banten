-- Initial schema for Keuangan HM

create table if not exists public.members (
	id text primary key,
	nama_pt text not null,
	bidang_usaha text not null,
	no_spbu text,
	wilayah text not null,
	phone text not null,
	email text not null,
	status text not null check (status in ('active', 'inactive')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.incomes (
	id text primary key,
	member_id text not null references public.members(id) on delete restrict,
	member_name text not null,
	date date,
	amount numeric(14, 2) not null check (amount >= 0),
	month text not null,
	year int not null,
	status text not null check (status in ('lunas', 'belum')),
	notes text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.saved_accounts (
	id text primary key,
	bank_code text not null,
	bank_name text not null,
	rekening text not null,
	atas_nama text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (bank_code, rekening)
);

create table if not exists public.spm_documents (
	id text primary key,
	nomor_spm text not null unique,
	tanggal date not null,
	tujuan text not null,
	lokasi text not null,
	total numeric(14, 2) not null check (total >= 0),
	status text not null check (status in ('draft', 'disetujui', 'dibayar')),
	nama_ketua text not null,
	nama_bendahara text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.spm_line_items (
	id text primary key,
	spm_id text not null references public.spm_documents(id) on delete cascade,
	uraian text not null,
	bank_code text not null,
	bank_name text not null,
	rekening text not null,
	atas_nama text not null,
	jumlah numeric(14, 2) not null check (jumlah >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.manual_expenses (
	id text primary key,
	spm_number text not null,
	date date not null,
	type text not null,
	amount numeric(14, 2) not null check (amount >= 0),
	recipient text not null,
	account_number text not null,
	bank text not null,
	bank_code text not null,
	notes text not null default '',
	spm_status text not null check (spm_status in ('draft', 'disetujui', 'dibayar')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists idx_members_status on public.members(status);
create index if not exists idx_incomes_member_id on public.incomes(member_id);
create index if not exists idx_incomes_year_month on public.incomes(year, month);
create index if not exists idx_saved_accounts_bank on public.saved_accounts(bank_code);
create index if not exists idx_spm_documents_status on public.spm_documents(status);
create index if not exists idx_spm_line_items_spm_id on public.spm_line_items(spm_id);
create index if not exists idx_manual_expenses_date on public.manual_expenses(date);

alter table public.members enable row level security;
alter table public.incomes enable row level security;
alter table public.saved_accounts enable row level security;
alter table public.spm_documents enable row level security;
alter table public.spm_line_items enable row level security;
alter table public.manual_expenses enable row level security;

create policy "Allow all for members" on public.members
for all using (true) with check (true);

create policy "Allow all for incomes" on public.incomes
for all using (true) with check (true);

create policy "Allow all for saved_accounts" on public.saved_accounts
for all using (true) with check (true);

create policy "Allow all for spm_documents" on public.spm_documents
for all using (true) with check (true);

create policy "Allow all for spm_line_items" on public.spm_line_items
for all using (true) with check (true);

create policy "Allow all for manual_expenses" on public.manual_expenses
for all using (true) with check (true);
