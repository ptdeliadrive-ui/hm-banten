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
  const ws = workbook.addWorksheet("Laporan");

  ws.addRow(["DATA REALISASI PEMASUKAN DAN PENGELUARAN"]);
  ws.addRow(["DPC HISWANA MIGAS BANTEN"]);
  ws.addRow([`Periode ${params.periodLabel}`]);
  ws.addRow([]);

  ws.addRow(["No", "Uraian", "Pemasukan (Debet)", "Pengeluaran (Kredit)"]);

  const startSaldoDate = new Date(params.periodStart.getTime() - 24 * 60 * 60 * 1000);
  ws.addRow([
    1,
    `Saldo per ${formatDateID(startSaldoDate)}`,
    params.saldoAwal >= 0 ? params.saldoAwal : null,
    params.saldoAwal < 0 ? Math.abs(params.saldoAwal) : null,
  ]);

  params.rows.forEach((r, idx) => {
    ws.addRow([idx + 2, r.uraian, r.pemasukan || null, r.pengeluaran || null]);
  });

  ws.addRow([
    params.rows.length + 2,
    "Saldo akhir periode",
    params.saldoAkhir >= 0 ? params.saldoAkhir : null,
    params.saldoAkhir < 0 ? Math.abs(params.saldoAkhir) : null,
  ]);
  ws.addRow(["", "Total Mutasi Periode", params.totalIncome, params.totalExpense]);

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 24;

  ws.getColumn(3).numFmt = "#,##0";
  ws.getColumn(4).numFmt = "#,##0";

  const detailWs = workbook.addWorksheet("Detail Pemasukan");

  // Collect all unique keterangan texts to use as pivot column headers.
  const uniqueKetSet = new Set<string>();
  params.incomeDetails.forEach((row) => {
    row.keteranganList.forEach((k) => {
      if (k.text) uniqueKetSet.add(k.text.trim().toUpperCase());
    });
  });
  const uniqueKetHeaders = [...uniqueKetSet];

  detailWs.addRow(["DETAIL PEMASUKAN"]);
  detailWs.addRow([`Periode ${params.periodLabel}`]);
  detailWs.addRow([]);
  detailWs.addRow(["No", "Tanggal", "Anggota", "Bulan", "Tahun", "Jumlah", ...uniqueKetHeaders]);

  params.incomeDetails.forEach((item, idx) => {
    // Build a map of keterangan text -> nominal for this row.
    const ketMap = new Map<string, number>();
    item.keteranganList.forEach((k) => {
      if (k.text) {
        const key = k.text.trim().toUpperCase();
        ketMap.set(key, (ketMap.get(key) || 0) + (k.amount ?? 0));
      }
    });

    detailWs.addRow([
      idx + 1,
      item.tanggal,
      item.anggota,
      item.bulan,
      item.tahun,
      item.jumlah,
      ...uniqueKetHeaders.map((header) => ketMap.get(header) || null),
    ]);
  });

  if (params.incomeDetails.length === 0) {
    detailWs.addRow(["", "", "Tidak ada data pemasukan untuk periode ini"]);
  }

  detailWs.getColumn(1).width = 8;
  detailWs.getColumn(2).width = 16;
  detailWs.getColumn(3).width = 36;
  detailWs.getColumn(4).width = 14;
  detailWs.getColumn(5).width = 12;
  detailWs.getColumn(6).width = 18;
  uniqueKetHeaders.forEach((_, i) => {
    detailWs.getColumn(7 + i).width = 24;
    detailWs.getColumn(7 + i).numFmt = "#,##0";
  });
  detailWs.getColumn(6).numFmt = "#,##0";

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
        <div className="text-center mb-3">
          <p className="font-bold text-sm">DATA REALISASI PEMASUKAN DAN PENGELUARAN</p>
          <p className="font-bold text-sm">DPC HISWANA MIGAS BANTEN</p>
          <p className="text-sm">Periode {periodLabel}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1 w-10 text-center">No.</th>
                <th className="border border-black px-2 py-1 text-center tracking-[0.2em]">URAIAN</th>
                <th className="border border-black px-2 py-1 w-40 text-center">PEMASUKAN (DEBET)</th>
                <th className="border border-black px-2 py-1 w-40 text-center">PENGELUARAN (KREDIT)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1 text-center">1</td>
                <td className="border border-black px-2 py-1">Saldo per {formatDateID(new Date(period.start.getTime() - 24 * 60 * 60 * 1000))}</td>
                <td className="border border-black px-2 py-1 text-right">{report.saldoAwal >= 0 ? formatCurrency(report.saldoAwal) : "-"}</td>
                <td className="border border-black px-2 py-1 text-right">{report.saldoAwal < 0 ? formatCurrency(Math.abs(report.saldoAwal)) : "-"}</td>
              </tr>

              {report.rows.map((row, idx) => (
                <tr key={`${row.uraian}-${idx}`}>
                  <td className="border border-black px-2 py-1 text-center">{idx + 2}</td>
                  <td className="border border-black px-2 py-1">{row.uraian}</td>
                  <td className="border border-black px-2 py-1 text-right">{row.pemasukan > 0 ? formatCurrency(row.pemasukan) : "-"}</td>
                  <td className="border border-black px-2 py-1 text-right">{row.pengeluaran > 0 ? formatCurrency(row.pengeluaran) : "-"}</td>
                </tr>
              ))}

              <tr className="font-semibold">
                <td className="border border-black px-2 py-1 text-center">{report.rows.length + 2}</td>
                <td className="border border-black px-2 py-1">Saldo akhir periode</td>
                <td className="border border-black px-2 py-1 text-right">{report.saldoAkhir >= 0 ? formatCurrency(report.saldoAkhir) : "-"}</td>
                <td className="border border-black px-2 py-1 text-right">{report.saldoAkhir < 0 ? formatCurrency(Math.abs(report.saldoAkhir)) : "-"}</td>
              </tr>

              <tr className="font-bold">
                <td className="border border-black px-2 py-1 text-right" colSpan={2}>Total</td>
                <td className="border border-black px-2 py-1 text-right">{formatCurrency(report.totalIncome)}</td>
                <td className="border border-black px-2 py-1 text-right">{formatCurrency(report.totalExpense)}</td>
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
