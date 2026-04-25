import { forwardRef } from "react";
import { type SPMDocument, BANK_CODES, inferSPMNumberType } from "@/lib/spm-store";
import { formatCurrency } from "@/lib/store";
import { terbilang } from "@/lib/terbilang";

interface Props {
  spm: SPMDocument;
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function buildHeaderKeterangan(spm: SPMDocument): string {
  if (spm.keteranganHeader && spm.keteranganHeader.trim()) return spm.keteranganHeader;

  const nomorType = inferSPMNumberType(spm.nomorSPM);
  if (nomorType !== "TF" && nomorType !== "OPRASIONAL") return "";

  const baseDate = new Date(spm.tanggal);
  const month = spm.keteranganBulan || (Number.isNaN(baseDate.getTime()) ? 1 : baseDate.getMonth() + 1);
  const year = spm.keteranganTahun || (Number.isNaN(baseDate.getTime()) ? new Date().getFullYear() : baseDate.getFullYear());
  const bulan = MONTHS_ID[Math.max(1, Math.min(12, month)) - 1].toUpperCase();

  if (nomorType === "TF") {
    return `OPERASIONAL TRANSPORT FEE BULAN ${bulan} ${year}`;
  }

  return `OPERASIONAL KANTOR BULAN ${bulan} ${year}`;
}

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

const SPMPrintView = forwardRef<HTMLDivElement, Props>(({ spm }, ref) => {
  const headerKeterangan = buildHeaderKeterangan(spm);

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto font-serif text-[11px] leading-relaxed print:p-6 print:text-[10px]" style={{ minHeight: '297mm' }}>
      <style>{`
        .spm-table { width: 100%; border-collapse: collapse !important; border-spacing: 0 !important; }
        .spm-table th, .spm-table td {
          border: 1px solid black !important;
          padding: 3px 6px;
        }
        @media print {
          .spm-table { border-collapse: collapse !important; border-spacing: 0 !important; }
          .spm-table th, .spm-table td {
            border: 1px solid black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* ── KOP SURAT ── */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Logo kiri */}
          <div style={{ width: '110px', flexShrink: 0 }}>
            <img
              src="/LOGO HM DI PAKE.png"
              alt="Logo Hiswana Migas"
              style={{ width: '110px', height: 'auto', display: 'block' }}
            />
          </div>
          {/* Teks kop — benar-benar center karena ada spacer kanan sama lebar */}
          <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: '1.35', textAlign: 'center', flex: 1 }}>
            <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#000', margin: 0 }}>DEWAN PIMPINAN CABANG BANTEN</p>
            <p style={{ fontSize: '14.5px', fontWeight: 'bold', color: '#000', margin: 0 }}>HIMPUNAN WIRASWASTA NASIONAL MINYAK DAN GAS BUMI</p>
            <p style={{ fontSize: '34px', fontWeight: '900', color: '#0000CC', margin: 0, letterSpacing: '2px', fontFamily: 'Arial Black, Arial, sans-serif' }}>HISWANA MIGAS</p>
            <p style={{ fontSize: '12px', color: '#000', margin: 0 }}>Yusuf Martadilaga No. 42 Serang Telp. (0254) 201453 Fax. (0254) 201067</p>
            <p style={{ fontSize: '12px', color: '#000', margin: 0 }}>E-mail : migasbanten@yahoo.com</p>
          </div>
          {/* Spacer kanan selebar logo agar teks benar-benar center */}
          <div style={{ width: '110px', flexShrink: 0 }} />
        </div>
        {/* Garis double di bawah kop */}
        <div style={{ borderTop: '3px solid black', marginTop: '5px' }} />
        <div style={{ borderTop: '1px solid black', marginTop: '2px', marginBottom: '10px' }} />
      </div>
      {/* Header */}
      <div className="text-center mb-3" style={{ lineHeight: '1.2' }}>
        <h1 className="text-xl font-bold tracking-widest uppercase" style={{ marginBottom: 0 }}>SURAT PERINTAH MEMBAYAR</h1>
        <h2 className="text-base font-bold tracking-widest" style={{ marginTop: 0, marginBottom: 0 }}>(SPM)</h2>
        {headerKeterangan && (
          <p className="text-sm font-bold uppercase tracking-wide" style={{ marginTop: 0, marginBottom: 0 }}>{headerKeterangan}</p>
        )}
        <p className="text-sm" style={{ marginTop: '2px', marginBottom: 0 }}>
          Nomor: <span className="font-bold" style={{ borderBottom: '1px solid black', paddingBottom: '1px' }}>{spm.nomorSPM}</span>
        </p>
      </div>

      {/* Tujuan */}
      <div className="mb-5 text-sm">
        <p>Yth.</p>
        <p className="font-semibold">{spm.tujuan}</p>
        <p>di - {spm.lokasi}</p>
      </div>

      {/* Table */}
      <table className="spm-table" style={{ marginBottom: '1rem', fontSize: '11px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center', width: '28px' }}>No</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'left' }}>Uraian</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center', width: '80px' }}>Kategori</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center', width: '90px' }}>Bank Tujuan<br />(Kode Bank)</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center', width: '90px' }}>Rekening Tujuan</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center', width: '90px' }}>Atas Nama</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right', width: '90px' }}>Jumlah Uang</th>
          </tr>
        </thead>
        <tbody>
          {spm.items.map((item, i) => (
            <tr key={item.id || i}>
              <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>{i + 1}</td>
              <td style={{ border: '1px solid black', padding: '3px 6px' }}>{item.uraian}</td>
              <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>{item.kategori || spm.kategori || '-'}</td>
              <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>{`${item.bankName} (${item.bankCode})`}</td>
              <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>{item.rekening}</td>
              <td style={{ border: '1px solid black', padding: '3px 6px' }}>{item.atasNama}</td>
              <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{formatCurrency(item.jumlah)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
            <td colSpan={6} style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>TOTAL :</td>
            <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(spm.total)}</td>
          </tr>
          <tr>
            <td colSpan={7} style={{ border: '1px solid black', padding: '4px 6px' }}>
              <span style={{ fontWeight: 'bold' }}>Terbilang:</span> <em>{terbilang(spm.total)}</em>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Signatures */}
      <div className="flex justify-between mt-8 text-sm">
        <div className="text-center w-[45%]">
          <p className="mb-1">&nbsp;</p>
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
