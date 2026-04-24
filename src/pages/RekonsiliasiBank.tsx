import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIncomes } from "@/lib/income-context";
import { useFinance } from "@/lib/finance-context";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Landmark } from "lucide-react";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

type BankReconciliationRow = {
  id: number;
  period_year: number;
  period_month: number | null;
  saldo_awal: number;
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo_buku: number;
  saldo_bank: number;
  selisih: number;
  notes: string;
  created_at: string;
};

function formatDateTime(dateText: string) {
  const date = new Date(dateText);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
}

export default function RekonsiliasiBank() {
  const { incomes } = useIncomes();
  const { allExpenses } = useFinance();
  const { user, role } = useAuth();

  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [saldoBank, setSaldoBank] = useState<string>("");
  const [showSaldoAwalDetail, setShowSaldoAwalDetail] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savedRows, setSavedRows] = useState<BankReconciliationRow[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<number | null>(null);

  const { saldoAwal, totalPemasukan, totalPengeluaran, saldoBuku, pemasukanSebelumPeriodeList, pengeluaranSebelumPeriodeList } = useMemo(() => {
    const year = Number(filterYear);
    const monthIdx = filterMonth === "all" ? -1 : MONTHS.indexOf(filterMonth);

    const periodStart = monthIdx === -1
      ? new Date(year, 0, 1)
      : new Date(year, monthIdx, 1);

    const monthIndexByLabel = new Map(MONTHS.map((m, idx) => [m.toLowerCase(), idx]));

    const resolveIncomeDate = (income: (typeof incomes)[number]): Date | null => {
      if (income.date) {
        const parsed = new Date(income.date);
        if (!isNaN(parsed.getTime())) return parsed;
      }

      const fallbackMonthIdx = monthIndexByLabel.get(income.month.toLowerCase());
      if (fallbackMonthIdx === undefined) return null;

      return new Date(income.year, fallbackMonthIdx, 1);
    };

    const matchDate = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const yMatch = d.getFullYear() === year;
      const mMatch = monthIdx === -1 || d.getMonth() === monthIdx;
      return yMatch && mMatch;
    };

    const matchMonthYear = (month: string, yr: number) => {
      const yMatch = yr === year;
      const mMatch = monthIdx === -1 || MONTHS[monthIdx]?.toLowerCase() === month.toLowerCase();
      return yMatch && mMatch;
    };

    const totalPemasukan = incomes
      .filter(i => i.status === "lunas" && (
        i.date ? matchDate(i.date) : matchMonthYear(i.month, i.year)
      ))
      .reduce((sum, i) => sum + i.amount, 0);

    const totalPengeluaran = allExpenses
      .filter(e => e.spmStatus === "dibayar" && matchDate(e.date))
      .reduce((sum, e) => sum + e.amount, 0);

    const pemasukanSebelumPeriodeList = incomes
      .filter(i => i.status === "lunas")
      .filter(i => {
        const d = resolveIncomeDate(i);
        return !!d && d < periodStart;
      });

    const pemasukanSebelumPeriode = pemasukanSebelumPeriodeList
      .reduce((sum, i) => sum + i.amount, 0);

    const pengeluaranSebelumPeriodeList = allExpenses
      .filter(e => e.spmStatus === "dibayar")
      .filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        if (isNaN(d.getTime())) return false;
        return d < periodStart;
      });

    const pengeluaranSebelumPeriode = pengeluaranSebelumPeriodeList
      .reduce((sum, e) => sum + e.amount, 0);

    const saldoAwal = pemasukanSebelumPeriode - pengeluaranSebelumPeriode;
    const saldoBuku = saldoAwal + totalPemasukan - totalPengeluaran;

    return {
      saldoAwal,
      totalPemasukan,
      totalPengeluaran,
      saldoBuku,
      pemasukanSebelumPeriodeList,
      pengeluaranSebelumPeriodeList,
    };
  }, [incomes, allExpenses, filterMonth, filterYear]);

  const saldoBankNum = Number(saldoBank.replace(/\D/g, "")) || 0;
  const selisih = saldoBankNum - saldoBuku;
  const seimbang = saldoBank !== "" && selisih === 0;
  const adaBank = saldoBank !== "";
  const periodMonth = filterMonth === "all" ? null : MONTHS.indexOf(filterMonth) + 1;

  const loadSavedRows = async () => {
    setLoadingHistory(true);
    let query = supabase
      .from("bank_reconciliations")
      .select("id, period_year, period_month, saldo_awal, total_pemasukan, total_pengeluaran, saldo_buku, saldo_bank, selisih, notes, created_at")
      .eq("period_year", Number(filterYear))
      .order("created_at", { ascending: false })
      .limit(15);

    query = periodMonth === null ? query.is("period_month", null) : query.eq("period_month", periodMonth);

    const { data, error } = await query;
    if (error) {
      toast.error(`Gagal memuat riwayat rekonsiliasi: ${error.message}`);
      setLoadingHistory(false);
      return;
    }

    setSavedRows((data || []) as BankReconciliationRow[]);
    setLoadingHistory(false);
  };

  useEffect(() => {
    setSelectedSavedId(null);
    void loadSavedRows();
  }, [filterMonth, filterYear]);

  const saveReconciliation = async () => {
    if (!user || !role) {
      toast.error("Session tidak ditemukan. Silakan login ulang.");
      return;
    }
    if (!adaBank) {
      toast.error("Isi saldo bank terlebih dahulu.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("bank_reconciliations").insert({
      period_year: Number(filterYear),
      period_month: periodMonth,
      saldo_awal: saldoAwal,
      total_pemasukan: totalPemasukan,
      total_pengeluaran: totalPengeluaran,
      saldo_buku: saldoBuku,
      saldo_bank: saldoBankNum,
      selisih,
      notes: notes.trim(),
      created_by_user_id: user.id,
      created_by_role: role,
    });

    if (error) {
      toast.error(`Gagal menyimpan rekonsiliasi: ${error.message}`);
      setSaving(false);
      return;
    }

    toast.success("Rekonsiliasi berhasil disimpan.");
    setSaving(false);
    await loadSavedRows();
  };

  const applySavedRow = (row: BankReconciliationRow) => {
    setSelectedSavedId(row.id);
    setSaldoBank(String(Math.round(row.saldo_bank)));
    setNotes(row.notes || "");
    toast.success("Data riwayat diterapkan ke form.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Landmark className="h-6 w-6" /> Rekonsiliasi Bank
        </h2>
        <p className="text-sm text-muted-foreground">Bandingkan saldo buku aplikasi dengan saldo bank</p>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filter Periode</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label>Bulan</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Bulan</SelectItem>
                  {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tahun</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Saldo Awal Periode (otomatis)</Label>
              <Input className="w-56" value={formatCurrency(saldoAwal)} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo Awal</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(saldoAwal)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pemasukan</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-green-600">{formatCurrency(totalPemasukan)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-red-600">{formatCurrency(totalPengeluaran)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo Buku (Aplikasi)</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(saldoBuku)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Komponen Saldo Awal</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowSaldoAwalDetail((v) => !v)}>
            {showSaldoAwalDetail ? "Sembunyikan Detail" : "Lihat Komponen Saldo Awal"}
          </Button>
        </CardHeader>
        {showSaldoAwalDetail && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm text-green-700">Pemasukan Sebelum Periode</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="pb-2 text-left">Tanggal</th>
                          <th className="pb-2 text-left">Anggota</th>
                          <th className="pb-2 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pemasukanSebelumPeriodeList
                          .sort((a, b) => {
                            const aDate = a.date ? new Date(a.date).getTime() : 0;
                            const bDate = b.date ? new Date(b.date).getTime() : 0;
                            return aDate - bDate;
                          })
                          .map((i) => (
                            <tr key={i.id} className="border-b last:border-0">
                              <td className="py-1.5">{i.date || `${i.month} ${i.year}`}</td>
                              <td className="py-1.5">{i.memberName}</td>
                              <td className="py-1.5 text-right">{formatCurrency(i.amount)}</td>
                            </tr>
                          ))}
                        {pemasukanSebelumPeriodeList.length === 0 && (
                          <tr><td colSpan={3} className="py-3 text-center text-muted-foreground">Tidak ada data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-2 text-sm font-semibold text-green-700">
                    <span>Total</span>
                    <span>{formatCurrency(pemasukanSebelumPeriodeList.reduce((s, i) => s + i.amount, 0))}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm text-red-700">Pengeluaran Sebelum Periode</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="pb-2 text-left">Tanggal</th>
                          <th className="pb-2 text-left">Uraian</th>
                          <th className="pb-2 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pengeluaranSebelumPeriodeList
                          .sort((a, b) => {
                            const aDate = a.date ? new Date(a.date).getTime() : 0;
                            const bDate = b.date ? new Date(b.date).getTime() : 0;
                            return aDate - bDate;
                          })
                          .map((e) => (
                            <tr key={e.id} className="border-b last:border-0">
                              <td className="py-1.5">{e.date || "-"}</td>
                              <td className="py-1.5">{e.type || e.notes || "-"}</td>
                              <td className="py-1.5 text-right">{formatCurrency(e.amount)}</td>
                            </tr>
                          ))}
                        {pengeluaranSebelumPeriodeList.length === 0 && (
                          <tr><td colSpan={3} className="py-3 text-center text-muted-foreground">Tidak ada data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-2 text-sm font-semibold text-red-700">
                    <span>Total</span>
                    <span>{formatCurrency(pengeluaranSebelumPeriodeList.reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo Awal = Total Pemasukan sebelum periode - Total Pengeluaran sebelum periode</span>
                <span className="font-semibold">{formatCurrency(saldoAwal)}</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Rekonsiliasi */}
      <Card>
        <CardHeader><CardTitle className="text-base">Input Saldo Bank</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-sm space-y-1">
            <Label>Saldo Rekening Bank (Rp)</Label>
            <Input
              placeholder="Masukkan saldo dari rekening bank..."
              value={saldoBank}
              onChange={e => setSaldoBank(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          <div className="max-w-xl space-y-1">
            <Label>Catatan (opsional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Selisih karena biaya admin bank belum dicatat."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void saveReconciliation()} disabled={saving || !adaBank}>
              {saving ? "Menyimpan..." : "Simpan Rekonsiliasi"}
            </Button>
            <Button variant="outline" onClick={() => void loadSavedRows()} disabled={loadingHistory}>
              {loadingHistory ? "Memuat..." : "Muat Ulang Riwayat"}
            </Button>
          </div>

          {adaBank && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo Buku (Aplikasi)</span>
                <span className="font-medium">{formatCurrency(saldoBuku)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo Bank</span>
                <span className="font-medium">{formatCurrency(saldoBankNum)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold">Selisih</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${selisih === 0 ? "text-green-600" : "text-red-600"}`}>
                    {selisih >= 0 ? "+" : ""}{formatCurrency(selisih)}
                  </span>
                  {seimbang ? (
                    <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Seimbang
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Ada Selisih
                    </Badge>
                  )}
                </div>
              </div>
              {!seimbang && (
                <p className="text-xs text-muted-foreground">
                  {selisih > 0
                    ? "Saldo bank lebih besar dari saldo buku. Kemungkinan ada pemasukan yang belum dicatat di aplikasi."
                    : "Saldo buku lebih besar dari saldo bank. Kemungkinan ada pengeluaran yang belum dicatat atau pemasukan yang belum masuk ke bank."}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat Rekonsiliasi Tersimpan</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left">Waktu Simpan</th>
                  <th className="pb-2 text-right">Saldo Bank</th>
                  <th className="pb-2 text-right">Selisih</th>
                  <th className="pb-2 text-left">Catatan</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {savedRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2">{formatDateTime(row.created_at)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.saldo_bank)}</td>
                    <td className={`py-2 text-right font-medium ${row.selisih === 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(row.selisih)}
                    </td>
                    <td className="py-2">{row.notes || "-"}</td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant={selectedSavedId === row.id ? "default" : "outline"}
                        onClick={() => applySavedRow(row)}
                      >
                        Terapkan
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loadingHistory && savedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      Belum ada data rekonsiliasi tersimpan untuk periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Tabel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Rincian Pemasukan (Lunas)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left">Anggota</th>
                  <th className="pb-2 text-left">Bulan</th>
                  <th className="pb-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {incomes
                  .filter(i => {
                    const year = Number(filterYear);
                    const monthIdx = filterMonth === "all" ? -1 : MONTHS.indexOf(filterMonth);
                    if (i.status !== "lunas") return false;
                    if (i.date) {
                      const d = new Date(i.date);
                      return d.getFullYear() === year && (monthIdx === -1 || d.getMonth() === monthIdx);
                    }
                    return i.year === year && (monthIdx === -1 || MONTHS[monthIdx]?.toLowerCase() === i.month.toLowerCase());
                  })
                  .map(i => (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="py-1.5">{i.memberName}</td>
                      <td className="py-1.5">{i.month} {i.year}</td>
                      <td className="py-1.5 text-right text-green-600">{formatCurrency(i.amount)}</td>
                    </tr>
                  ))}
                {incomes.filter(i => i.status === "lunas").length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Rincian Pengeluaran (Dibayar)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left">Uraian</th>
                  <th className="pb-2 text-left">Tanggal</th>
                  <th className="pb-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {allExpenses
                  .filter(e => {
                    const year = Number(filterYear);
                    const monthIdx = filterMonth === "all" ? -1 : MONTHS.indexOf(filterMonth);
                    if (e.spmStatus !== "dibayar" || !e.date) return false;
                    const d = new Date(e.date);
                    return d.getFullYear() === year && (monthIdx === -1 || d.getMonth() === monthIdx);
                  })
                  .map(e => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-1.5">{e.type || e.notes || "-"}</td>
                      <td className="py-1.5">{e.date}</td>
                      <td className="py-1.5 text-right text-red-600">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                {allExpenses.filter(e => e.spmStatus === "dibayar").length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
