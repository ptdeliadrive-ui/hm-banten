import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/store";
import { useIncomes } from "@/lib/income-context";
import { useFinance } from "@/lib/finance-context";
import { useMembers } from "@/lib/member-context";
import { useReactToPrint } from "react-to-print";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type ReportMode = "bulanan" | "tahunan";

type ReportRow = {
  uraian: string;
  pemasukan: number;
  pengeluaran: number;
};

type IncomeDetailRow = {
  tanggal: string;
  anggota: string;
  bulan: string;
  tahun: number;
  jumlah: number;
  keteranganList: Array<{ text: string; amount: number | null }>;
};

function parseIncomeNotes(raw?: string): Array<{ text: string; amount: number | null }> {
  const value = (raw || "").trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            const text = item.trim();
            if (!text) return null;
            return { text, amount: null };
          }

          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            const text = String(obj.text ?? obj.label ?? obj.keterangan ?? "").trim();
            if (!text) return null;

            const amountRaw = obj.amount ?? obj.nominal;
            const amountNum = Number(amountRaw);
            return {
              text,
              amount: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null,
            };
          }

          return null;
        })
        .filter((item): item is { text: string; amount: number | null } => Boolean(item));
    }
  } catch {
    // Backward compatibility for previous plain text notes.
  }

  return [{ text: value, amount: null }];
}

function parseIncomeDate(i: { date: string; month: string; year: number }) {
  if (i.date) {
    const d = new Date(i.date);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === String(i.month || "").toLowerCase());
  if (monthIndex >= 0) return new Date(i.year, monthIndex, 1);
  return new Date(i.year, 0, 1);
}

function formatDateID(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Warna brand Hiswana ──────────────────────────────────────────────
const COLOR_HEADER_BG   = "FF003087"; // biru tua
const COLOR_HEADER_FG   = "FFFFFFFF"; // putih
const COLOR_SUBHEADER   = "FF1F5EBF"; // biru medium
const COLOR_SALDO_BG    = "FFD6E4F7"; // biru muda
const COLOR_TOTAL_BG    = "FFFCE4D6"; // oranye muda
const COLOR_STRIPE      = "FFF0F5FF"; // biru sangat muda (stripe genap)
const COLOR_BORDER      = "FFB0C4DE"; // biru abu-abu

type ExcelCell = {
  font?: Partial<{ bold: boolean; color: { argb: string }; size: number; name: string }>;
  fill?: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
  alignment?: Partial<{ horizontal: string; vertical: string; wrapText: boolean }>;
  border?: {
    top?: { style: string; color?: { argb: string } };
    left?: { style: string; color?: { argb: string } };
    bottom?: { style: string; color?: { argb: string } };
    right?: { style: string; color?: { argb: string } };
  };
  numFmt?: string;
  value?: unknown;
};

function applyBorder(cell: ExcelCell) {
  const thin = { style: "thin", color: { argb: COLOR_BORDER } };
  cell.border = { top: thin, left: thin, bottom: thin, right: thin };
}

function styleHeaderCell(cell: ExcelCell) {
  cell.font = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 10, name: "Arial" };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  applyBorder(cell);
}

function styleDataCell(cell: ExcelCell, stripe: boolean) {
  if (stripe) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_STRIPE } };
  cell.font = { size: 10, name: "Arial" };
  applyBorder(cell);
}

async function exportRowsToExcel(params: {
  periodLabel: string;
  rows: ReportRow[];
  incomeDetails: IncomeDetailRow[];
  saldoAwal: number;
  saldoAkhir: number;
  totalIncome: number;
  totalExpense: number;
  periodStart: Date;
  fileName: string;
}) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "Hiswana Migas DPC Banten";
  workbook.created = new Date();

  // ── Sheet 1: Laporan ─────────────────────────────────────────────────
  const ws = workbook.addWorksheet("Laporan Keuangan");
  ws.views = [{ state: "frozen", ySplit: 7 }];

  ws.columns = [
    { width: 6 },
    { width: 46 },
    { width: 22 },
    { width: 22 },
  ];

  // Kop organisasi
  ws.mergeCells("A1:D1");
  const titleOrg = ws.getCell("A1");
  titleOrg.value = "HIMPUNAN WIRASWASTA NASIONAL MINYAK DAN GAS BUMI";
  titleOrg.font = { bold: true, size: 13, name: "Arial", color: { argb: COLOR_HEADER_BG } };
  titleOrg.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A2:D2");
  const titleDpc = ws.getCell("A2");
  titleDpc.value = "DEWAN PIMPINAN CABANG BANTEN (HISWANA MIGAS)";
  titleDpc.font = { bold: true, size: 11, name: "Arial", color: { argb: COLOR_HEADER_BG } };
  titleDpc.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A3:D3");
  const titleAddr = ws.getCell("A3");
  titleAddr.value = "Jl. Yusuf Martadilaga No. 42 Serang  |  Telp. (0254) 201453  |  Email: migasbanten@yahoo.com";
  titleAddr.font = { size: 9, name: "Arial" };
  titleAddr.alignment = { horizontal: "center", vertical: "middle" };

  // Garis pembatas bawah kop
  ws.mergeCells("A4:D4");
  const borderRow = ws.getCell("A4");
  borderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } };
  ws.getRow(4).height = 3;

  ws.mergeCells("A5:D5");

  // Judul laporan
  ws.mergeCells("A6:D6");
  const titleLaporan = ws.getCell("A6");
  titleLaporan.value = `DATA REALISASI PEMASUKAN DAN PENGELUARAN — PERIODE ${params.periodLabel.toUpperCase()}`;
  titleLaporan.font = { bold: true, size: 11, name: "Arial" };
  titleLaporan.alignment = { horizontal: "center", vertical: "middle" };
  titleLaporan.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SALDO_BG } };
  ws.getRow(6).height = 20;

  // Header tabel
  const headerRow = ws.getRow(7);
  headerRow.height = 22;
  ["No", "Uraian", "Pemasukan (Debet)", "Pengeluaran (Kredit)"].forEach((v, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = v;
    styleHeaderCell(cell as unknown as ExcelCell);
  });

  // Baris saldo awal
  let rowNum = 8;
  const startSaldoDate = new Date(params.periodStart.getTime() - 24 * 60 * 60 * 1000);
  const saldoAwalRow = ws.getRow(rowNum);
  saldoAwalRow.getCell(1).value = 1;
  saldoAwalRow.getCell(2).value = `Saldo per ${formatDateID(startSaldoDate)}`;
  saldoAwalRow.getCell(3).value = params.saldoAwal >= 0 ? params.saldoAwal : null;
  saldoAwalRow.getCell(4).value = params.saldoAwal < 0 ? Math.abs(params.saldoAwal) : null;
  [1, 2, 3, 4].forEach((c) => {
    const cell = saldoAwalRow.getCell(c);
    cell.font = { bold: true, size: 10, name: "Arial" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SALDO_BG } };
    applyBorder(cell as unknown as ExcelCell);
  });
  saldoAwalRow.getCell(3).numFmt = "#,##0";
  saldoAwalRow.getCell(4).numFmt = "#,##0";
  rowNum++;

  // Baris data
  params.rows.forEach((r, idx) => {
    const dataRow = ws.getRow(rowNum);
    const stripe = idx % 2 === 1;
    dataRow.getCell(1).value = idx + 2;
    dataRow.getCell(2).value = r.uraian;
    dataRow.getCell(3).value = r.pemasukan || null;
    dataRow.getCell(4).value = r.pengeluaran || null;
    [1, 2, 3, 4].forEach((c) => {
      styleDataCell(dataRow.getCell(c) as unknown as ExcelCell, stripe);
    });
    dataRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    dataRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    dataRow.getCell(3).numFmt = "#,##0";
    dataRow.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    dataRow.getCell(4).numFmt = "#,##0";
    dataRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
    rowNum++;
  });

  // Baris saldo akhir
  const saldoAkhirRow = ws.getRow(rowNum);
  saldoAkhirRow.getCell(1).value = params.rows.length + 2;
  saldoAkhirRow.getCell(2).value = "Saldo akhir periode";
  saldoAkhirRow.getCell(3).value = params.saldoAkhir >= 0 ? params.saldoAkhir : null;
  saldoAkhirRow.getCell(4).value = params.saldoAkhir < 0 ? Math.abs(params.saldoAkhir) : null;
  [1, 2, 3, 4].forEach((c) => {
    const cell = saldoAkhirRow.getCell(c);
    cell.font = { bold: true, size: 10, name: "Arial" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SALDO_BG } };
    applyBorder(cell as unknown as ExcelCell);
  });
  saldoAkhirRow.getCell(3).numFmt = "#,##0";
  saldoAkhirRow.getCell(4).numFmt = "#,##0";
  rowNum++;

  // Baris total
  const totalRow = ws.getRow(rowNum);
  totalRow.getCell(2).value = "TOTAL MUTASI PERIODE";
  totalRow.getCell(3).value = params.totalIncome;
  totalRow.getCell(4).value = params.totalExpense;
  [1, 2, 3, 4].forEach((c) => {
    const cell = totalRow.getCell(c);
    cell.font = { bold: true, size: 10, name: "Arial", color: { argb: "FF000000" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
    applyBorder(cell as unknown as ExcelCell);
  });
  totalRow.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(3).numFmt = "#,##0";
  totalRow.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(4).numFmt = "#,##0";
  totalRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };

  // ── Sheet 2: Detail Pemasukan ─────────────────────────────────────────
  const detailWs = workbook.addWorksheet("Detail Pemasukan");
  detailWs.views = [{ state: "frozen", ySplit: 5 }];

  const uniqueKetSet = new Set<string>();
  params.incomeDetails.forEach((row) => {
    row.keteranganList.forEach((k) => {
      if (k.text) uniqueKetSet.add(k.text.trim().toUpperCase());
    });
  });
  const uniqueKetHeaders = [...uniqueKetSet];
  const totalCols = 6 + uniqueKetHeaders.length;

  detailWs.columns = [
    { width: 6 },
    { width: 16 },
    { width: 36 },
    { width: 14 },
    { width: 8 },
    { width: 18 },
    ...uniqueKetHeaders.map(() => ({ width: 22 })),
  ];

  // Kop sheet 2
  detailWs.mergeCells(1, 1, 1, totalCols);
  const detailTitle = detailWs.getCell("A1");
  detailTitle.value = "HIMPUNAN WIRASWASTA NASIONAL MINYAK DAN GAS BUMI — DPC BANTEN";
  detailTitle.font = { bold: true, size: 12, name: "Arial", color: { argb: COLOR_HEADER_BG } };
  detailTitle.alignment = { horizontal: "center", vertical: "middle" };

  detailWs.mergeCells(2, 1, 2, totalCols);
  const detailSub = detailWs.getCell("A2");
  detailSub.value = `DETAIL PEMASUKAN — PERIODE ${params.periodLabel.toUpperCase()}`;
  detailSub.font = { bold: true, size: 10, name: "Arial" };
  detailSub.alignment = { horizontal: "center", vertical: "middle" };
  detailSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SALDO_BG } };

  detailWs.mergeCells(3, 1, 3, totalCols);
  detailWs.getRow(3).height = 6;

  // Header detail
  const detailHeader = detailWs.getRow(4);
  detailHeader.height = 22;
  ["No", "Tanggal", "Anggota", "Bulan", "Tahun", "Jumlah", ...uniqueKetHeaders].forEach((v, i) => {
    const cell = detailHeader.getCell(i + 1);
    cell.value = v;
    styleHeaderCell(cell as unknown as ExcelCell);
  });

  let dRowNum = 5;
  params.incomeDetails.forEach((item, idx) => {
    const ketMap = new Map<string, number>();
    item.keteranganList.forEach((k) => {
      if (k.text) {
        const key = k.text.trim().toUpperCase();
        ketMap.set(key, (ketMap.get(key) || 0) + (k.amount ?? 0));
      }
    });

    const dRow = detailWs.getRow(dRowNum);
    const stripe = idx % 2 === 1;
    dRow.getCell(1).value = idx + 1;
    dRow.getCell(2).value = item.tanggal;
    dRow.getCell(3).value = item.anggota;
    dRow.getCell(4).value = item.bulan;
    dRow.getCell(5).value = item.tahun;
    dRow.getCell(6).value = item.jumlah;
    uniqueKetHeaders.forEach((h, hi) => {
      dRow.getCell(7 + hi).value = ketMap.get(h) || null;
    });

    for (let c = 1; c <= totalCols; c++) {
      styleDataCell(dRow.getCell(c) as unknown as ExcelCell, stripe);
    }
    dRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    dRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
    dRow.getCell(6).numFmt = "#,##0";
    dRow.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    uniqueKetHeaders.forEach((_, hi) => {
      dRow.getCell(7 + hi).numFmt = "#,##0";
      dRow.getCell(7 + hi).alignment = { horizontal: "right", vertical: "middle" };
    });
    dRowNum++;
  });

  if (params.incomeDetails.length === 0) {
    detailWs.mergeCells(dRowNum, 1, dRowNum, totalCols);
    detailWs.getCell(dRowNum, 1).value = "Tidak ada data pemasukan untuk periode ini";
    detailWs.getCell(dRowNum, 1).alignment = { horizontal: "center", vertical: "middle" };
  }

  // ── Generate file ────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = params.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const Laporan = () => {
  const { incomes } = useIncomes();
  const { spms, manualExpenses } = useFinance();
  const { members } = useMembers();
  const printRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<ReportMode>("bulanan");

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    incomes.forEach((i) => years.add(i.year));
    spms.forEach((s) => {
      const y = new Date(s.tanggal).getFullYear();
      if (!Number.isNaN(y)) years.add(y);
    });
    manualExpenses.forEach((e) => {
      const y = new Date(e.date).getFullYear();
      if (!Number.isNaN(y)) years.add(y);
    });

    if (years.size === 0) years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [incomes, spms, manualExpenses]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [saldoAwalInput, setSaldoAwalInput] = useState<string>("");

  // Load saldo awal override dari localStorage saat tahun berubah
  useEffect(() => {
    const stored = localStorage.getItem(`laporan_saldo_awal_${selectedYear}`);
    setSaldoAwalInput(stored ?? "");
  }, [selectedYear]);

  const handleSaldoAwalChange = (val: string) => {
    setSaldoAwalInput(val);
    if (val.trim() === "") {
      localStorage.removeItem(`laporan_saldo_awal_${selectedYear}`);
    } else {
      localStorage.setItem(`laporan_saldo_awal_${selectedYear}`, val);
    }
  };

  const period = useMemo(() => {
    const year = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];
    const start = mode === "bulanan" ? new Date(year, selectedMonth, 1, 0, 0, 0, 0) : new Date(year, 0, 1, 0, 0, 0, 0);
    const end = mode === "bulanan" ? new Date(year, selectedMonth + 1, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);
    return { year, start, end };
  }, [availableYears, mode, selectedMonth, selectedYear]);

  const report = useMemo(() => {
    const incomeInRange = incomes.filter((inc) => {
      if (inc.status !== "lunas") return false;
      const d = parseIncomeDate(inc);
      return d >= period.start && d <= period.end;
    });

    const spmInRange = spms.filter((s) => {
      if (s.status !== "disetujui" && s.status !== "dibayar") return false;
      const d = new Date(s.tanggal);
      return !Number.isNaN(d.getTime()) && d >= period.start && d <= period.end;
    });

    const manualInRange = manualExpenses.filter((e) => {
      const d = new Date(e.date);
      return !Number.isNaN(d.getTime()) && d >= period.start && d <= period.end;
    });

    const incomeBefore = incomes
      .filter((inc) => inc.status === "lunas")
      .reduce((sum, inc) => {
        const d = parseIncomeDate(inc);
        return d < period.start ? sum + inc.amount : sum;
      }, 0);

    const spmBefore = spms
      .filter((s) => s.status === "disetujui" || s.status === "dibayar")
      .reduce((sum, s) => {
        const d = new Date(s.tanggal);
        return !Number.isNaN(d.getTime()) && d < period.start ? sum + s.total : sum;
      }, 0);

    const manualBefore = manualExpenses.reduce((sum, e) => {
      const d = new Date(e.date);
      return !Number.isNaN(d.getTime()) && d < period.start ? sum + e.amount : sum;
    }, 0);

    const saldoAwalAuto = incomeBefore - spmBefore - manualBefore;
    const saldoAwalOverride = saldoAwalInput.trim() !== "" ? Number(saldoAwalInput.replace(/[^0-9.\-]/g, "")) : NaN;
    const saldoAwal = !Number.isNaN(saldoAwalOverride) ? saldoAwalOverride : saldoAwalAuto;

    const incomeGrouped = new Map<string, number>();
    const memberById = new Map(members.map((m) => [m.id, m]));
    incomeInRange.forEach((inc) => {
      const bidangUsaha = memberById.get(inc.memberId)?.bidangUsaha?.trim();
      const bidangLabel = (bidangUsaha && bidangUsaha.length > 0 ? bidangUsaha : "LAINNYA").toUpperCase();
      const key = `IURAN HISWANA BIDANG ${bidangLabel}`;
      incomeGrouped.set(key, (incomeGrouped.get(key) || 0) + inc.amount);
    });

    const expenseGrouped = new Map<string, number>();
    spmInRange.forEach((s) => {
      if (s.items.length > 0) {
        s.items.forEach((item) => {
          const key = (item.kategori || s.kategori || "Pengeluaran SPM").trim() || "Pengeluaran SPM";
          expenseGrouped.set(key, (expenseGrouped.get(key) || 0) + Number(item.jumlah || 0));
        });
      } else {
        const key = s.kategori || "Pengeluaran SPM";
        expenseGrouped.set(key, (expenseGrouped.get(key) || 0) + s.total);
      }
    });
    manualInRange.forEach((e) => {
      const key = e.type?.trim() || "Pengeluaran Manual";
      expenseGrouped.set(key, (expenseGrouped.get(key) || 0) + e.amount);
    });

    const incomeRows: ReportRow[] = [...incomeGrouped.entries()].map(([uraian, pemasukan]) => ({ uraian, pemasukan, pengeluaran: 0 }));
    const expenseRows: ReportRow[] = [...expenseGrouped.entries()].map(([uraian, pengeluaran]) => ({ uraian, pemasukan: 0, pengeluaran }));

    const incomeDetails: IncomeDetailRow[] = incomeInRange
      .slice()
      .sort((a, b) => parseIncomeDate(a).getTime() - parseIncomeDate(b).getTime())
      .map((inc) => ({
        tanggal: inc.date || "-",
        anggota: inc.memberName,
        bulan: inc.month,
        tahun: inc.year,
        jumlah: inc.amount,
        keteranganList: parseIncomeNotes(inc.notes),
      }));

    const totalIncome = incomeRows.reduce((s, r) => s + r.pemasukan, 0);
    const totalExpense = expenseRows.reduce((s, r) => s + r.pengeluaran, 0);
    const saldoAkhir = saldoAwal + totalIncome - totalExpense;

    return {
      saldoAwal,
      saldoAkhir,
      totalIncome,
      totalExpense,
      rows: [...incomeRows, ...expenseRows],
      incomeDetails,
    };
  }, [incomes, manualExpenses, members, period.end, period.start, spms, saldoAwalInput]);

  const periodLabel =
    mode === "bulanan"
      ? `${MONTHS[selectedMonth]} ${period.year}`
      : `Januari ${period.year} s.d. Desember ${period.year}`;

  const namaKetuaTtd = localStorage.getItem("spm_nama_ketua") || "KETUA";
  const namaBendaharaTtd = localStorage.getItem("spm_nama_bendahara") || "BENDAHARA";

  const handleExport = async () => {
    await exportRowsToExcel({
      periodLabel,
      rows: report.rows,
      incomeDetails: report.incomeDetails,
      saldoAwal: report.saldoAwal,
      saldoAkhir: report.saldoAkhir,
      totalIncome: report.totalIncome,
      totalExpense: report.totalExpense,
      periodStart: period.start,
      fileName: `laporan-keuangan-${mode}-${period.year}${mode === "bulanan" ? `-${String(selectedMonth + 1).padStart(2, "0")}` : ""}.xlsx`,
    });
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan-Keuangan-${mode}-${period.year}${mode === "bulanan" ? `-${String(selectedMonth + 1).padStart(2, "0")}` : ""}`,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Laporan Keuangan</h2>
          <p className="text-sm text-muted-foreground">Format laporan realisasi pemasukan dan pengeluaran bulanan/tahunan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />Cetak A4
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />Export
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Jenis Laporan</p>
              <Select value={mode} onValueChange={(v: ReportMode) => setMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulanan">Bulanan</SelectItem>
                  <SelectItem value="tahunan">Tahunan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tahun</p>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "bulanan" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Bulan</p>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, idx) => (
                      <SelectItem key={m} value={String(idx)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Saldo Awal Tahun {selectedYear}
                <span className="ml-1 text-[10px] text-muted-foreground/60">(kosongkan = otomatis)</span>
              </p>
              <Input
                type="number"
                placeholder="Masukkan saldo awal"
                value={saldoAwalInput}
                onChange={(e) => handleSaldoAwalChange(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Saldo Awal</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(report.saldoAwal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Mutasi Periode</p>
            <p className="text-xl font-bold text-accent mt-1">{formatCurrency(report.totalIncome - report.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Saldo Akhir</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(report.saldoAkhir)}</p>
          </CardContent>
        </Card>
      </div>

      <div
        ref={printRef}
        className="bg-white text-black mx-auto max-w-[210mm] min-h-[297mm] p-6 print:p-5 print:max-w-none print:min-h-0"
      >
        {/* ── Kop Surat ── */}
        <div className="flex items-center gap-4 mb-1">
          <img
            src="/logo-hiswana-512.png"
            alt="Logo Hiswana Migas"
            className="h-16 w-16 object-contain print:h-14 print:w-14"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex-1 text-center">
            <p className="font-extrabold text-base leading-tight tracking-wide">HIMPUNAN WIRASWASTA NASIONAL MINYAK DAN GAS BUMI</p>
            <p className="font-bold text-sm leading-tight">DEWAN PIMPINAN CABANG BANTEN</p>
            <p className="text-xs text-gray-600 mt-0.5">Jl. Yusuf Martadilaga No. 42 Serang  |  Telp. (0254) 201453  |  migasbanten@yahoo.com</p>
          </div>
        </div>
        <div className="border-t-4 border-black mb-0.5" />
        <div className="border-t border-black mb-3" />

        {/* ── Judul Laporan ── */}
        <div className="text-center mb-4">
          <p className="font-bold text-sm uppercase tracking-wider">Data Realisasi Pemasukan dan Pengeluaran</p>
          <p className="text-sm">Periode {periodLabel}</p>
        </div>

        <div className="overflow-x-auto">
          <style>{`
            @media print {
              .laporan-table { width: 100%; border-collapse: collapse !important; }
              .laporan-table th, .laporan-table td { border: 1px solid black !important; }
            }
          `}</style>
          <table className="laporan-table w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-2 py-1.5 w-10 text-center font-bold">No.</th>
                <th className="border border-black px-2 py-1.5 text-center font-bold tracking-wide">URAIAN</th>
                <th className="border border-black px-2 py-1.5 w-40 text-center font-bold">PEMASUKAN (DEBET)</th>
                <th className="border border-black px-2 py-1.5 w-40 text-center font-bold">PENGELUARAN (KREDIT)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50">
                <td className="border border-black px-2 py-1 text-center font-semibold">1</td>
                <td className="border border-black px-2 py-1 font-semibold">Saldo per {formatDateID(new Date(period.start.getTime() - 24 * 60 * 60 * 1000))}</td>
                <td className="border border-black px-2 py-1 text-right font-semibold">{report.saldoAwal >= 0 ? formatCurrency(report.saldoAwal) : "-"}</td>
                <td className="border border-black px-2 py-1 text-right font-semibold">{report.saldoAwal < 0 ? formatCurrency(Math.abs(report.saldoAwal)) : "-"}</td>
              </tr>

              {report.rows.map((row, idx) => (
                <tr key={`${row.uraian}-${idx}`} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="border border-black px-2 py-1 text-center">{idx + 2}</td>
                  <td className="border border-black px-2 py-1">{row.uraian}</td>
                  <td className="border border-black px-2 py-1 text-right">{row.pemasukan > 0 ? formatCurrency(row.pemasukan) : "-"}</td>
                  <td className="border border-black px-2 py-1 text-right">{row.pengeluaran > 0 ? formatCurrency(row.pengeluaran) : "-"}</td>
                </tr>
              ))}

              <tr className="bg-blue-50 font-semibold">
                <td className="border border-black px-2 py-1 text-center">{report.rows.length + 2}</td>
                <td className="border border-black px-2 py-1">Saldo akhir periode</td>
                <td className="border border-black px-2 py-1 text-right">{report.saldoAkhir >= 0 ? formatCurrency(report.saldoAkhir) : "-"}</td>
                <td className="border border-black px-2 py-1 text-right">{report.saldoAkhir < 0 ? formatCurrency(Math.abs(report.saldoAkhir)) : "-"}</td>
              </tr>

              <tr className="font-bold bg-orange-50">
                <td className="border border-black px-2 py-1.5 text-right" colSpan={2}>TOTAL MUTASI PERIODE</td>
                <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(report.totalIncome)}</td>
                <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(report.totalExpense)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex justify-between text-sm">
          <div className="w-[45%]">
            <p className="mb-16">KETUA,</p>
            <p className="font-semibold underline uppercase">{namaKetuaTtd}</p>
          </div>
          <div className="w-[45%] text-right">
            <p className="mb-1">Serang, {formatDateID(new Date())}</p>
            <p className="mb-14">DPC HISWANA MIGAS BANTEN</p>
            <p className="font-semibold underline uppercase">{namaBendaharaTtd}</p>
            <p>BENDAHARA</p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview Laporan Cetak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gunakan tombol Cetak A4 untuk mencetak atau simpan sebagai PDF dengan layout portrait.
            </p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default Laporan;
