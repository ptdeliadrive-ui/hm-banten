// Simple in-memory store with React state management
// Will be replaced with Lovable Cloud later

export interface Member {
  id: string;
  namaPT: string;
  bidangUsaha: string;
  wilayah: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  noSPBU?: string;
}

export interface Income {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  amount: number;
  month: string;
  year: number;
  status: 'lunas' | 'belum';
  notes: string;
  proofUrl?: string;
  proofFileId?: string;
  proofFileName?: string;
}

export interface Expense {
  id: string;
  spmNumber: string;
  date: string;
  type: string;
  amount: number;
  recipient: string;
  accountNumber: string;
  bank: string;
  bankCode: string;
  notes: string;
  spmStatus: 'draft' | 'disetujui' | 'dibayar';
}

// Sample data
export const sampleMembers: Member[] = [
  { id: '1', namaPT: 'PT PERTAMINA PATRA NIAGA', bidangUsaha: 'Distribusi BBM', wilayah: 'SERANG', phone: '08123456789', email: 'pertamina@email.com', status: 'active' },
  { id: '2', namaPT: 'PT ELNUSA PETROFIN', bidangUsaha: 'Distribusi BBM', wilayah: 'CILEGON', phone: '08234567890', email: 'elnusa@email.com', status: 'active' },
  { id: '3', namaPT: 'PT AKR CORPORINDO TBK', bidangUsaha: 'Perdagangan BBM', wilayah: 'TANGERANG', phone: '08345678901', email: 'akr@email.com', status: 'active' },
  { id: '4', namaPT: 'PT BUMI CAHAYA UNGGUL', bidangUsaha: 'Distribusi BBM', wilayah: 'SERANG', phone: '08456789012', email: 'bcu@email.com', status: 'active' },
  { id: '5', namaPT: 'PT SUMBER ENERGI JAYA', bidangUsaha: 'Perdagangan BBM', wilayah: 'CILEGON', phone: '08567890123', email: 'sej@email.com', status: 'active' },
  { id: '6', namaPT: 'PT CAKRA BANGUN MANDIRI', bidangUsaha: 'Distribusi BBM', wilayah: 'TANGERANG', phone: '08678901234', email: 'cbm@email.com', status: 'active' },
  { id: '7', namaPT: 'PT FAJAR MITRA PERKASA', bidangUsaha: 'Perdagangan BBM', wilayah: 'SERANG', phone: '08789012345', email: 'fmp@email.com', status: 'active' },
  { id: '8', namaPT: 'PT GADING SAKTI INDONESIA', bidangUsaha: 'Distribusi BBM', wilayah: 'LEBAK', phone: '08890123456', email: 'gsi@email.com', status: 'active' },
  { id: '9', namaPT: 'PT HARUM JAYA PERSADA', bidangUsaha: 'Perdagangan BBM', wilayah: 'PANDEGLANG', phone: '08901234567', email: 'hjp@email.com', status: 'active' },
  { id: '10', namaPT: 'PT INDAH KIAT ENERGI', bidangUsaha: 'Distribusi BBM', wilayah: 'CILEGON', phone: '08112233445', email: 'ike@email.com', status: 'active' },
  { id: '11', namaPT: 'PT JAYA ABADI PETROLEUM', bidangUsaha: 'Perdagangan BBM', wilayah: 'TANGERANG', phone: '08223344556', email: 'jap@email.com', status: 'active' },
  { id: '12', namaPT: 'PT KARYA MULIA ENERGI', bidangUsaha: 'Distribusi BBM', wilayah: 'SERANG', phone: '08334455667', email: 'kme@email.com', status: 'active' },
  { id: '13', namaPT: 'PT LESTARI BUMI ENERGI', bidangUsaha: 'Perdagangan BBM', wilayah: 'CILEGON', phone: '08445566778', email: 'lbe@email.com', status: 'active' },
  { id: '14', namaPT: 'PT MANDALA ENERGI UTAMA', bidangUsaha: 'Distribusi BBM', wilayah: 'TANGERANG', phone: '08556677889', email: 'meu@email.com', status: 'active' },
  { id: '15', namaPT: 'PT NUSANTARA FUEL', bidangUsaha: 'Perdagangan BBM', wilayah: 'SERANG', phone: '08667788990', email: 'nf@email.com', status: 'active' },
  { id: '16', namaPT: 'PT OMEGA PETRO ENERGI', bidangUsaha: 'Distribusi BBM', wilayah: 'LEBAK', phone: '08778899001', email: 'ope@email.com', status: 'active' },
  { id: '17', namaPT: 'PT PRIMA ENERGI BERSAMA', bidangUsaha: 'Perdagangan BBM', wilayah: 'PANDEGLANG', phone: '08889900112', email: 'peb@email.com', status: 'active' },
  { id: '18', namaPT: 'PT QUANTUM ENERGI', bidangUsaha: 'Distribusi BBM', wilayah: 'CILEGON', phone: '08990011223', email: 'qe@email.com', status: 'active' },
  { id: '19', namaPT: 'PT RAJAWALI PETROLEUM', bidangUsaha: 'Perdagangan BBM', wilayah: 'TANGERANG', phone: '08101122334', email: 'rp@email.com', status: 'active' },
  { id: '20', namaPT: 'PT SURYA ENERGI MANDIRI', bidangUsaha: 'Distribusi BBM', wilayah: 'SERANG', phone: '08212233445', email: 'sem@email.com', status: 'active' },
  { id: '21', namaPT: 'PT TIGA PILAR ENERGI', bidangUsaha: 'Perdagangan BBM', wilayah: 'CILEGON', phone: '08323344556', email: 'tpe@email.com', status: 'active' },
  { id: '22', namaPT: 'PT UTAMA NIAGA ENERGI', bidangUsaha: 'Distribusi BBM', wilayah: 'TANGERANG', phone: '08434455667', email: 'une@email.com', status: 'active' },
  { id: '23', namaPT: 'PT VISI GLOBAL ENERGI', bidangUsaha: 'Perdagangan BBM', wilayah: 'LEBAK', phone: '08545566778', email: 'vge@email.com', status: 'active' },
  { id: '24', namaPT: 'PT WAHANA ENERGI NUSANTARA', bidangUsaha: 'Distribusi BBM', wilayah: 'PANDEGLANG', phone: '08656677889', email: 'wen@email.com', status: 'active' },
  { id: '25', namaPT: 'PT XTRA ENERGI INDONESIA', bidangUsaha: 'Perdagangan BBM', wilayah: 'SERANG', phone: '08767788990', email: 'xei@email.com', status: 'active' },
  { id: '26', namaPT: 'PT YUDHA MITRA PETROLEUM', bidangUsaha: 'Distribusi BBM', wilayah: 'CILEGON', phone: '08878899001', email: 'ymp@email.com', status: 'active' },
  { id: '27', namaPT: 'PT ZAMRUD ENERGI PERSADA', bidangUsaha: 'Perdagangan BBM', wilayah: 'TANGERANG', phone: '08989900112', email: 'zep@email.com', status: 'active' },
  { id: '28', namaPT: 'PT ALPHA PETRO MANDIRI', bidangUsaha: 'Distribusi BBM', wilayah: 'SERANG', phone: '08190011223', email: 'apm@email.com', status: 'active' },
  { id: '29', namaPT: 'PT BETA ENERGI SEJAHTERA', bidangUsaha: 'Perdagangan BBM', wilayah: 'LEBAK', phone: '08291122334', email: 'bes@email.com', status: 'active' },
  { id: '30', namaPT: 'PT DELTA FUEL INDONESIA', bidangUsaha: 'Distribusi BBM', wilayah: 'PANDEGLANG', phone: '08392233445', email: 'dfi@email.com', status: 'active' },
];

export const sampleIncomes: Income[] = [
  { id: '1', memberId: '1', memberName: 'PT PERTAMINA PATRA NIAGA', date: '2025-04-05', amount: 200000, month: 'April', year: 2025, status: 'lunas', notes: 'Iuran bulanan' },
  { id: '2', memberId: '2', memberName: 'PT ELNUSA PETROFIN', date: '2025-04-03', amount: 200000, month: 'April', year: 2025, status: 'lunas', notes: 'Iuran bulanan' },
  { id: '3', memberId: '3', memberName: 'PT AKR CORPORINDO TBK', date: '2025-03-07', amount: 200000, month: 'Maret', year: 2025, status: 'lunas', notes: '' },
];

export const sampleExpenses: Expense[] = [
  { id: '1', spmNumber: 'SPM-2025-001', date: '2025-04-01', type: 'Operasional', amount: 500000, recipient: 'PT Listrik', accountNumber: '1234567890', bank: 'BCA', bankCode: '014', notes: 'Bayar listrik kantor', spmStatus: 'dibayar' },
  { id: '2', spmNumber: 'SPM-2025-002', date: '2025-04-03', type: 'Konsumsi', amount: 250000, recipient: 'Catering Ibu Sri', accountNumber: '0987654321', bank: 'BRI', bankCode: '002', notes: 'Rapat bulanan', spmStatus: 'dibayar' },
  { id: '3', spmNumber: 'SPM-2025-003', date: '2025-04-08', type: 'Perlengkapan', amount: 350000, recipient: 'Toko ATK Jaya', accountNumber: '1122334455', bank: 'Mandiri', bankCode: '008', notes: 'Beli ATK', spmStatus: 'disetujui' },
  { id: '4', spmNumber: 'SPM-2025-004', date: '2025-04-09', type: 'Transport', amount: 150000, recipient: 'Budi Santoso', accountNumber: '5566778899', bank: 'BNI', bankCode: '009', notes: 'Transport rapat', spmStatus: 'draft' },
];

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function getMonthlyData() {
  const data = MONTHS.map(month => {
    const income = sampleIncomes.filter(i => i.month === month && i.status === 'lunas').reduce((sum, i) => sum + i.amount, 0);
    const expense = sampleExpenses.filter(e => {
      const d = new Date(e.date);
      return MONTHS[d.getMonth()] === month;
    }).reduce((sum, e) => sum + e.amount, 0);
    return { month: month.substring(0, 3), pemasukan: income, pengeluaran: expense };
  });
  return data;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export function generateSPMNumber(): string {
  const year = new Date().getFullYear();
  const num = sampleExpenses.length + 1;
  return `SPM-${year}-${String(num).padStart(3, '0')}`;
}
