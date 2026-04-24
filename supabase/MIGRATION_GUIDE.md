# Supabase Migration Guide (Pindah ke Akun Baru)

Panduan ini untuk kasus project lama sudah nonaktif dan Anda ingin pakai akun/project Supabase baru.

## 1. Buat project baru di akun Supabase baru

1. Login ke dashboard Supabase akun baru.
2. Buat project baru.
3. Catat 3 nilai ini:
	- Project Ref
	- Project URL
	- Anon/Public key

## 2. Login Supabase CLI

```bash
npx supabase login
```

## 3. Link project lokal ke project baru

Ganti `<NEW_PROJECT_REF>` dengan project ref dari project baru.

```bash
npx supabase link --project-ref <NEW_PROJECT_REF>
```

## 4. Update project ref pada config lokal

Edit file `supabase/config.toml`:

```toml
project_id = "<NEW_PROJECT_REF>"
```

## 5. Push migration schema ke database baru

```bash
npx supabase db push
```

Migration yang dipush:
- `supabase/migrations/20260417172340_init_keuangan_hm_schema.sql`

## 6. Generate TypeScript types dari project baru

```bash
npx supabase gen types typescript --project-id <NEW_PROJECT_REF> --schema public > src/integrations/supabase/types.ts
```

## 7. Update env aplikasi ke project baru

Edit `.env`:

```env
VITE_SUPABASE_PROJECT_ID="<NEW_PROJECT_REF>"
VITE_SUPABASE_URL="https://<NEW_PROJECT_REF>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"
```

Lalu restart dev server.

## 8. Verifikasi tabel sudah terbentuk

Jalankan SQL ini di SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Catatan penting

- RLS saat ini aktif dan policy masih `allow all` untuk mempermudah transisi dari local state.
- Setelah autentikasi user diterapkan, policy harus diperketat.
