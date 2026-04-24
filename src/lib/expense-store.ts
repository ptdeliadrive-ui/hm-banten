import { isSPMApproved, type SPMDocument } from "./spm-store";
import { type Expense } from "./store";

// Convert approved/paid SPM documents to Expense format
export function spmToExpenses(spms: SPMDocument[]): Expense[] {
  return spms
    .filter((spm) => isSPMApproved(spm.status))
    .flatMap(spm =>
      spm.items.map((item, idx) => ({
        id: `spm-${spm.id}-${item.id}`,
        spmNumber: spm.nomorSPM,
        date: spm.tanggal,
        type: 'SPM',
        amount: item.jumlah,
        recipient: item.atasNama,
        accountNumber: item.rekening,
        bank: item.bankName,
        bankCode: item.bankCode,
        notes: item.uraian,
        spmStatus: spm.status,
      }))
    );
}
