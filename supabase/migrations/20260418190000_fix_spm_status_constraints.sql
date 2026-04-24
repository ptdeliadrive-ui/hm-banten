-- Ensure two-step SPM approval statuses are valid at database level.

update public.spm_documents
set status = 'disetujui_ketua'
where status = 'disetujui';

alter table public.spm_documents
  drop constraint if exists spm_documents_status_check;

alter table public.spm_documents
  add constraint spm_documents_status_check
  check (status in ('draft', 'disetujui_bendahara', 'disetujui_ketua', 'dibayar'));

alter table public.manual_expenses
  drop constraint if exists manual_expenses_spm_status_check;

alter table public.manual_expenses
  add constraint manual_expenses_spm_status_check
  check (spm_status in ('draft', 'disetujui', 'disetujui_bendahara', 'disetujui_ketua', 'dibayar'));