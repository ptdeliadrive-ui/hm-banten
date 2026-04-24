insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_proofs_public_read" on storage.objects;
create policy "payment_proofs_public_read" on storage.objects
for select
using (bucket_id = 'payment-proofs');

drop policy if exists "payment_proofs_admin_insert" on storage.objects;
create policy "payment_proofs_admin_insert" on storage.objects
for insert
with check (
  bucket_id = 'payment-proofs'
  and public.current_app_role() = 'admin'
);

drop policy if exists "payment_proofs_admin_update" on storage.objects;
create policy "payment_proofs_admin_update" on storage.objects
for update
using (
  bucket_id = 'payment-proofs'
  and public.current_app_role() = 'admin'
)
with check (
  bucket_id = 'payment-proofs'
  and public.current_app_role() = 'admin'
);

drop policy if exists "payment_proofs_admin_delete" on storage.objects;
create policy "payment_proofs_admin_delete" on storage.objects
for delete
using (
  bucket_id = 'payment-proofs'
  and public.current_app_role() = 'admin'
);