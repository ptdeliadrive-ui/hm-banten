export interface SavedAccount {
  id: string;
  bankCode: string;
  bankName: string;
  rekening: string;
  atasNama: string;
}

export interface SPMLineItem {
  id: string;
  uraian: string;
  kategori: string;
  bankCode: string;
  bankName: string;
  rekening: string;
  atasNama: string;
  jumlah: number;
}

const SAVED_ACCOUNTS_KEY = 'spm_saved_accounts';

function generateAccountId(existingIds: Set<string>): string {
  let id = '';
  do {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  } while (existingIds.has(id));
  return id;
}

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]') as SavedAccount[];
    if (!Array.isArray(raw)) return [];

    const seenIds = new Set<string>();
    let hasIdFix = false;

    const normalized = raw.map((a) => {
      const next = { ...a };
      if (!next.id || seenIds.has(next.id)) {
        next.id = generateAccountId(seenIds);
        hasIdFix = true;
      }
      seenIds.add(next.id);
      return next;
    });

    if (hasIdFix) {
      setSavedAccounts(normalized);
    }

    return normalized;
  } catch { return []; }
}

export function setSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function addSavedAccount(account: Omit<SavedAccount, 'id'>): SavedAccount {
  const accounts = getSavedAccounts();
  const existing = accounts.find(a => a.rekening === account.rekening && a.bankCode === account.bankCode);
  if (existing) return existing;
  const newAcc = { ...account, id: generateAccountId(new Set(accounts.map((a) => a.id))) };
  accounts.push(newAcc);
  setSavedAccounts(accounts);
  return newAcc;
}

export function updateSavedAccount(id: string, data: Omit<SavedAccount, 'id'>) {
  let updated = false;
  const accounts = getSavedAccounts().map(a => {
    if (!updated && a.id === id) {
      updated = true;
      return { ...a, ...data };
    }
    return a;
  });
  setSavedAccounts(accounts);
}

export function deleteSavedAccount(id: string) {
  const accounts = getSavedAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return;
  accounts.splice(idx, 1);
  setSavedAccounts(accounts);
}

export interface SPMDocument {
  id: string;
  nomorSPM: string;
  tanggal: string;
  tujuan: string;
  lokasi: string;
  kategori: string;
  items: SPMLineItem[];
  total: number;
  status: SPMStatus;
  namaKetua: string;
  namaBendahara: string;
  approvedBendaharaAt?: string | null;
  approvedBendaharaUserId?: string | null;
  approvedKetuaAt?: string | null;
  approvedKetuaUserId?: string | null;
  createdAt: string;
}

export type SPMStatus = 'draft' | 'disetujui_bendahara' | 'disetujui_ketua' | 'dibayar';

export function normalizeSPMStatus(status?: string | null): SPMStatus {
  if (status === 'dibayar') return 'dibayar';
  if (status === 'disetujui_bendahara') return 'disetujui_bendahara';
  if (status === 'disetujui_ketua' || status === 'disetujui') return 'disetujui_ketua';
  return 'draft';
}

export function getSPMStatusLabel(status: SPMStatus): string {
  if (status === 'disetujui_bendahara') return 'Disetujui Bendahara';
  if (status === 'disetujui_ketua') return 'Disetujui Ketua';
  if (status === 'dibayar') return 'Dibayar';
  return 'Draft';
}

export function isSPMApproved(status: SPMStatus): boolean {
  return status === 'disetujui_ketua' || status === 'dibayar';
}

export const SPM_CATEGORIES_DEFAULT = [
  'Operasional Kantor',
  'Kegiatan Organisasi',
  'Administrasi',
  'Perjalanan Dinas',
  'Honorarium',
  'Rapat / Pertemuan',
  'Lain-lain',
];

const SPM_CATEGORIES_KEY = 'spm_categories';

export function getSPMCategories(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SPM_CATEGORIES_KEY) || 'null');
    if (Array.isArray(raw) && raw.length > 0) return raw as string[];
  } catch { /* empty */ }
  return [...SPM_CATEGORIES_DEFAULT];
}

export function saveSPMCategories(categories: string[]): void {
  localStorage.setItem(SPM_CATEGORIES_KEY, JSON.stringify(categories));
}

// Keep backward compat export
export const SPM_CATEGORIES = SPM_CATEGORIES_DEFAULT;

export type SPMNumberType = 'OPRASIONAL' | 'SPM' | 'TF';

export const SPM_NUMBER_TYPES: Array<{ value: SPMNumberType; label: string }> = [
  { value: 'OPRASIONAL', label: 'OPRASIONAL' },
  { value: 'SPM', label: 'SPM' },
  { value: 'TF', label: 'TF' },
];

export const BANK_CODES = [
  { code: '001', name: 'Bank Mandiri' },
  { code: '002', name: 'Bank BCA' },
  { code: '003', name: 'Bank BRI' },
  { code: '004', name: 'Bank BNI' },
  { code: '008', name: 'Bank Syariah Indonesia' },
  { code: '009', name: 'Bank Muamalat' },
  { code: '011', name: 'Bank Danamon' },
  { code: '013', name: 'Bank Permata' },
  { code: '014', name: 'Bank BCA Syariah' },
  { code: '016', name: 'Bank Maybank' },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function inferSPMNumberType(nomorSPM?: string): SPMNumberType {
  if (!nomorSPM) return 'TF';
  const match = nomorSPM.match(/^\d+\/([^/]+)\//i);
  const type = match?.[1]?.toUpperCase();
  if (type === 'OPRASIONAL' || type === 'SPM' || type === 'TF') {
    return type;
  }
  return 'TF';
}

export function generateSPMNumberNew(existing: SPMDocument[], tanggalSPM?: string, nomorType: SPMNumberType = 'TF'): string {
  const baseDate = tanggalSPM ? new Date(tanggalSPM) : new Date();
  const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  const year = safeDate.getFullYear();
  const month = ROMAN[safeDate.getMonth()];

  const latestNumberInYear = existing.reduce((max, spm) => {
    const match = spm.nomorSPM.match(/^(\d+)\/([^/]+)\/[^/]+\/[^/]+\/(\d{4})$/);
    if (!match) return max;

    const number = Number(match[1]);
    const spmYear = Number(match[3]);
    if (Number.isNaN(number) || spmYear !== year) return max;

    return Math.max(max, number);
  }, 0);

  const nextNumber = latestNumberInYear + 1;
  return `${nextNumber}/${nomorType}/DPC.Banten/${month}/${year}`;
}

export const sampleSPMs: SPMDocument[] = [
  {
    id: '1',
    nomorSPM: '01/SPM/DPC.Banten/IV/2025',
    tanggal: '2025-04-01',
    tujuan: 'Ketua Hiswana Migas DPC Banten',
    lokasi: 'Serang',
    items: [
      { id: '1', uraian: 'Bayar listrik kantor', kategori: 'Operasional Kantor', bankCode: '001', bankName: 'Bank Mandiri', rekening: '1234567890', atasNama: 'PT Listrik', jumlah: 500000 },
      { id: '2', uraian: 'Catering rapat bulanan', kategori: 'Kegiatan Organisasi', bankCode: '002', bankName: 'Bank BCA', rekening: '0987654321', atasNama: 'Catering Ibu Sri', jumlah: 250000 },
    ],
    total: 750000,
    status: 'dibayar',
    namaKetua: 'H. Ahmad Fauzi',
    namaBendahara: 'Siti Nurhaliza',
    approvedBendaharaAt: '2025-04-01T08:00:00',
    approvedKetuaAt: '2025-04-01T09:00:00',
    createdAt: '2025-04-01T00:00:00',
  },
  {
    id: '2',
    nomorSPM: '02/SPM/DPC.Banten/IV/2025',
    tanggal: '2025-04-08',
    tujuan: 'Ketua Hiswana Migas DPC Banten',
    lokasi: 'Serang',
    items: [
      { id: '1', uraian: 'Beli ATK', kategori: 'Administrasi', bankCode: '001', bankName: 'Bank Mandiri', rekening: '1122334455', atasNama: 'Toko ATK Jaya', jumlah: 350000 },
    ],
    total: 350000,
    status: 'disetujui_ketua',
    namaKetua: 'H. Ahmad Fauzi',
    namaBendahara: 'Siti Nurhaliza',
    approvedBendaharaAt: '2025-04-08T08:00:00',
    approvedKetuaAt: '2025-04-08T10:00:00',
    createdAt: '2025-04-08T00:00:00',
  },
  {
    id: '3',
    nomorSPM: '03/SPM/DPC.Banten/IV/2025',
    tanggal: '2025-04-09',
    tujuan: 'Ketua Hiswana Migas DPC Banten',
    lokasi: 'Serang',
    items: [
      { id: '1', uraian: 'Transport rapat', kategori: 'Perjalanan Dinas', bankCode: '004', bankName: 'Bank BNI', rekening: '5566778899', atasNama: 'Budi Santoso', jumlah: 150000 },
    ],
    total: 150000,
    status: 'draft',
    namaKetua: 'H. Ahmad Fauzi',
    namaBendahara: 'Siti Nurhaliza',
    createdAt: '2025-04-09T00:00:00',
  },
];
