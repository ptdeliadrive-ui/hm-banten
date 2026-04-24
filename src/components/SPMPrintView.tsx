import { forwardRef } from "react";
import { type SPMDocument, BANK_CODES } from "@/lib/spm-store";
import { formatCurrency } from "@/lib/store";
import { terbilang } from "@/lib/terbilang";

interface Props {
  spm: SPMDocument;
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

const SPMPrintView = forwardRef<HTMLDivElement, Props>(({ spm }, ref) => {
  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto font-serif text-[11px] leading-relaxed print:p-6 print:text-[10px]" style={{ minHeight: '297mm' }}>
      {/* Header */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-lg font-bold tracking-wide uppercase">SURAT PERINTAH MEMBAYAR</h1>
        <h2 className="text-base font-bold">(SPM)</h2>
        <p className="mt-2 text-sm">Nomor: <span className="font-bold underline">{spm.nomorSPM}</span></p>
      </div>

      {/* Tujuan */}
      <div className="mb-5 text-sm">
        <p>Yth.</p>
        <p className="font-semibold">{spm.tujuan}</p>
        <p>di - {spm.lokasi}</p>
      </div>

      {/* Table */}
      <table className="w-full border-collapse border border-black mb-4 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-2 py-1.5 w-8 text-center">No</th>
            <th className="border border-black px-2 py-1.5 text-left">Uraian</th>
            <th className="border border-black px-2 py-1.5 w-24 text-center">Bank Tujuan<br />(Kode Bank)</th>
            <th className="border border-black px-2 py-1.5 w-28 text-center">Rekening Tujuan</th>
            <th className="border border-black px-2 py-1.5 w-28 text-center">Atas Nama</th>
            <th className="border border-black px-2 py-1.5 w-28 text-right">Jumlah Uang</th>
          </tr>
        </thead>
        <tbody>
          {spm.items.map((item, i) => (
            <tr key={item.id || i}>
              <td className="border border-black px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-black px-2 py-1">{item.uraian}</td>
              <td className="border border-black px-2 py-1 text-center">{`${item.bankName} (${item.bankCode})`}</td>
              <td className="border border-black px-2 py-1 text-center">{item.rekening}</td>
              <td className="border border-black px-2 py-1">{item.atasNama}</td>
              <td className="border border-black px-2 py-1 text-right">{formatCurrency(item.jumlah)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-50">
            <td colSpan={5} className="border border-black px-2 py-1.5 text-right">TOTAL :</td>
            <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(spm.total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Terbilang */}
      <div className="mb-8 text-sm">
        <p><span className="font-semibold">Terbilang:</span> <em className="italic">{terbilang(spm.total)}</em></p>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-12 text-sm">
        <div className="text-center w-[45%]">
          <p className="font-semibold mb-16">Menyetujui,</p>
          <p className="font-bold underline">{spm.namaKetua}</p>
          <p>Ketua</p>
        </div>
        <div className="text-center w-[45%]">
          <p className="mb-1">{spm.lokasi}, {formatTanggal(spm.tanggal)}</p>
          <p className="font-semibold mb-14">Diajukan oleh,</p>
          <p className="font-bold underline">{spm.namaBendahara}</p>
          <p>Bendahara</p>
        </div>
      </div>

      {/* Kode Bank */}
      <div className="mt-12 text-[10px] border-t border-gray-400 pt-3">
        <p className="font-semibold mb-1">Nb: Kode Bank Tujuan</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {BANK_CODES.map(b => (
            <p key={b.code}>{b.code} — {b.name}</p>
          ))}
        </div>
      </div>
    </div>
  );
});

SPMPrintView.displayName = 'SPMPrintView';
export default SPMPrintView;
