alter table public.spm_line_items
  add column if not exists kategori text not null default 'Lain-lain';

update public.spm_line_items li
set kategori = coalesce(nullif(trim(sd.kategori), ''), 'Lain-lain')
from public.spm_documents sd
where sd.id = li.spm_id
  and (li.kategori is null or trim(li.kategori) = '' or li.kategori = 'Lain-lain');