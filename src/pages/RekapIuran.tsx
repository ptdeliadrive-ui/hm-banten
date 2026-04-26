import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useIncomes } from "@/lib/income-context";
import { useMembers } from "@/lib/member-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/store";
import { downloadRekapIuranExcel, downloadTabungTemplate, parseTabungExcel } from "@/lib/excel-parser";
import { toast } from "sonner";
import { useReactToPrint } from "react-to-print";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const REPORT_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const expenseLines = [
  { label: "Sekretaris SAM", amount: 700000 },
  { label: "Admin & Frontdesk", amount: 1000000 },
  { label: "Pengurusan TF (Sekretariat - 3 orang)", amount: 2000000 },
  { label: "Antar berkas ke Profinance", amount: 750000 },
];

type ParsedNote = {
  text: string;
  amount: number | null;
  month: string | null;
  year: number | null;
};

function formatNumberInput(value: number) {
  return value > 0 ? value.toLocaleString("id-ID") : "";
}

function toMonthLabel(monthIndex: number, year: number) {
  return `${MONTHS[monthIndex]} ${year}`;
}

function tabungKey(memberId: string, monthIndex: number, year: number) {
  return `${memberId}__${monthIndex}__${year}`;
}

function calculateTransportFee(totalTabung: number) {
  return Math.floor((totalTabung * 10) / 1000) * 1000;
}

function parseIncomeNotes(raw?: string): ParsedNote[] {
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
            return { text, amount: null, month: null, year: null };
          }

          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            const text = String(obj.text ?? obj.label ?? obj.keterangan ?? "").trim();
            if (!text) return null;

            const amountRaw = obj.amount ?? obj.nominal;
            const amountNum = Number(amountRaw);
            const monthRaw = obj.month ?? obj.bulan ?? obj.periodMonth;
            const yearRaw = obj.year ?? obj.tahun ?? obj.periodYear;
            const month = monthRaw === null || monthRaw === undefined ? null : String(monthRaw).trim();
            const yearNum = Number(yearRaw);
            return {
              text,
              amount: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null,
              month: month && month.length > 0 ? month : null,
              year: Number.isFinite(yearNum) && yearNum > 0 ? yearNum : null,
            };
          }

          return null;
        })
        .filter((item): item is ParsedNote => Boolean(item));
    }
  } catch {
    // Keep compatibility with legacy plain text notes.
  }

  return [{ text: value, amount: null, month: null, year: null }];
}

function isTransportFeeLabel(text: string) {
  const upper = text.toUpperCase();
  return upper.includes("TRANSPORT FEE") || upper.includes("IURAN TF") || /(^|\s)TF($|\s)/.test(upper);
}

function isHiswanaLabel(text: string) {
  return text.toUpperCase().includes("HISWANA");
}

function noteMatchesPeriod(note: ParsedNote, incomeMonth: string, incomeYear: number, targetMonth: string, targetYear: number) {
  const noteMonth = (note.month || incomeMonth || "").toLowerCase();
  const noteYear = note.year || incomeYear;
  return noteMonth === targetMonth.toLowerCase() && noteYear === targetYear;
}

function getIncomeComponentAmount(
  income: { amount: number; notes?: string; month: string; year: number },
  type: "hiswana" | "tf",
  targetMonth: string,
  targetYear: number,
) {
  const parsedNotes = parseIncomeNotes(income.notes);
  if (parsedNotes.length > 0) {
    const matching = parsedNotes.filter((item) =>
      type === "hiswana" ? isHiswanaLabel(item.text) : isTransportFeeLabel(item.text),
    );

    if (matching.length > 0) {
      const matchingByPeriod = matching.filter((item) =>
        noteMatchesPeriod(item, income.month, income.year, targetMonth, targetYear),
      );
      const amountFromItems = matchingByPeriod.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      if (amountFromItems > 0) return amountFromItems;
      if (
        matchingByPeriod.length === 1 &&
        matchingByPeriod[0].amount === null &&
        parsedNotes.length === 1
      ) {
        return income.amount;
      }
      return 0;
    }

    if (
      type === "hiswana" &&
      parsedNotes.length === 1 &&
      !isTransportFeeLabel(parsedNotes[0].text) &&
      noteMatchesPeriod(parsedNotes[0], income.month, income.year, targetMonth, targetYear)
    ) {
      return parsedNotes[0].amount ?? income.amount;
    }

    return 0;
  }

  if (income.month.toLowerCase() !== targetMonth.toLowerCase() || income.year !== targetYear) {
    return 0;
  }

  const noteText = (income.notes || "").toUpperCase();
  if (type === "tf") {
    return isTransportFeeLabel(noteText) ? income.amount : 0;
  }

  return isTransportFeeLabel(noteText) ? 0 : income.amount;
}

const RekapIuran = () => {
  const { role, user } = useAuth();
  const { incomes } = useIncomes();
  const { members } = useMembers();
  const canShowTabungInputTools = role !== "bendahara";

  const today = new Date();
  const [hiswanaMonth, setHiswanaMonth] = useState(today.getMonth());
  const [hiswanaYear, setHiswanaYear] = useState(today.getFullYear());
  const [tfMonth, setTfMonth] = useState(today.getMonth());
  const [tfYear, setTfYear] = useState(today.getFullYear());
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [manualTabungValue, setManualTabungValue] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [noSpm, setNoSpm] = useState<string>("");
  const [savingNoSpm, setSavingNoSpm] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [tabungValues, setTabungValues] = useState<Record<string, number>>({});

  const saveTabungValue = async (memberId: string, value: number) => {
    if (!user?.id || !role) {
      toast.error("Sesi login tidak valid. Silakan login ulang.");
      return false;
    }

    if (value <= 0) {
      const { error } = await supabase
        .from("rekap_iuran_tabung_values")
        .delete()
        .eq("period_year", tfYear)
        .eq("period_month", tfMonth + 1)
        .eq("member_id", memberId);

      if (error) {
        toast.error(`Gagal menghapus total tabung: ${error.message}`);
        return false;
      }

      return true;
    }

    const { error } = await supabase.from("rekap_iuran_tabung_values").upsert(
      {
        period_year: tfYear,
        period_month: tfMonth + 1,
        member_id: memberId,
        total_tabung: value,
        created_by_user_id: user.id,
        created_by_role: role,
      },
      { onConflict: "period_year,period_month,member_id" },
    );

    if (error) {
      toast.error(`Gagal menyimpan total tabung: ${error.message}`);
      return false;
    }

    return true;
  };

  useEffect(() => {
    let active = true;

    const loadTabung = async () => {
      const { data, error } = await supabase
        .from("rekap_iuran_tabung_values")
        .select("member_id, total_tabung")
        .eq("period_year", tfYear)
        .eq("period_month", tfMonth + 1);

      if (!active) return;

      if (error) {
        console.error("Failed to load total tabung", error);
        setTabungValues({});
        return;
      }

      const next: Record<string, number> = {};
      for (const item of data || []) {
        const memberId = String(item.member_id || "");
        if (!memberId) continue;
        next[tabungKey(memberId, tfMonth, tfYear)] = Number(item.total_tabung || 0);
      }

      setTabungValues(next);
    };

    void loadTabung();

    return () => {
      active = false;
    };
  }, [tfMonth, tfYear]);

  useEffect(() => {
    let active = true;

    const loadNoSpm = async () => {
      setNoSpm("");

      const { data, error } = await supabase
        .from("rekap_iuran_spm_notes")
        .select("no_spm")
        .eq("period_year", tfYear)
        .eq("period_month", tfMonth + 1)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!active) return;

      if (error) {
        console.error("Failed to load No SPM", error);
        return;
      }

      setNoSpm(data?.[0]?.no_spm ?? "");
    };

    void loadNoSpm();

    return () => {
      active = false;
    };
  }, [tfMonth, tfYear]);

  const agenPsoMembers = useMemo(
    () =>
      members
        .filter(
          (member) =>
            member.status === "active" &&
            member.bidangUsaha.trim().toLowerCase() === "agen elpiji pso",
        )
        .slice()
        .sort((left, right) => left.namaPT.localeCompare(right.namaPT, "id-ID")),
    [members],
  );

  const rows = useMemo(() => {
    return agenPsoMembers
      .map((member) => {
        const hiswanaAmount = incomes
          .filter(
            (income) =>
              income.memberId === member.id &&
              income.status === "lunas",
          )
          .reduce((sum, income) => sum + getIncomeComponentAmount(income, "hiswana", MONTHS[hiswanaMonth], hiswanaYear), 0);

        const transportFeeReceived = incomes
          .filter(
            (income) =>
              income.memberId === member.id &&
              income.status === "lunas",
          )
          .reduce((sum, income) => sum + getIncomeComponentAmount(income, "tf", MONTHS[tfMonth], tfYear), 0);

        const totalTabung = tabungValues[tabungKey(member.id, tfMonth, tfYear)] || 0;
        const transportFeeCollected = calculateTransportFee(totalTabung);

        return {
          id: member.id,
          namaAgen: member.namaPT,
          wilayah: member.wilayah || "-",
          totalTabung,
          transportFeeCollected,
          hiswanaAmount,
          transportFeeReceived,
          checked: hiswanaAmount > 0 || transportFeeReceived > 0,
        };
      })
      .filter((row) => row.hiswanaAmount > 0 || row.transportFeeReceived > 0);
  }, [agenPsoMembers, hiswanaMonth, hiswanaYear, incomes, tabungValues, tfMonth, tfYear]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        totalTabung: acc.totalTabung + row.totalTabung,
        transportFeeCollected: acc.transportFeeCollected + row.transportFeeCollected,
        hiswanaAmount: acc.hiswanaAmount + row.hiswanaAmount,
        transportFeeReceived: acc.transportFeeReceived + row.transportFeeReceived,
      }),
      {
        totalTabung: 0,
        transportFeeCollected: 0,
        hiswanaAmount: 0,
        transportFeeReceived: 0,
      },
    );
  }, [rows]);

  const totalPengeluaran = useMemo(() => expenseLines.reduce((sum, item) => sum + item.amount, 0), []);
  const totalPendapatan = totals.transportFeeReceived;
  const saldo = totalPendapatan - totalPengeluaran;

  const formattedToday = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const handleTabungChange = (memberId: string, rawValue: string) => {
    const numericValue = Number(rawValue.replace(/[^0-9]/g, "")) || 0;
    const key = tabungKey(memberId, tfMonth, tfYear);
    setTabungValues((prev) => ({ ...prev, [key]: numericValue }));
  };

  const handleSaveManualTabung = async () => {
    if (!selectedMemberId) {
      toast.error("Pilih anggota terlebih dahulu.");
      return;
    }

    const value = Number(manualTabungValue.replace(/[^0-9]/g, "")) || 0;
    const saved = await saveTabungValue(selectedMemberId, value);
    if (!saved) return;

    const key = tabungKey(selectedMemberId, tfMonth, tfYear);
    setTabungValues((prev) => ({ ...prev, [key]: value }));
    setManualTabungValue("");
    toast.success("Total tabung berhasil disimpan.");
  };

  const handleDownloadTemplate = async () => {
    await downloadTabungTemplate(agenPsoMembers.map((m) => m.namaPT));
  };

  const handleDeleteTabungMember = async () => {
    if (!selectedMemberId) {
      toast.error("Pilih anggota terlebih dahulu.");
      return;
    }

    const deleted = await saveTabungValue(selectedMemberId, 0);
    if (!deleted) return;

    const key = tabungKey(selectedMemberId, tfMonth, tfYear);
    setTabungValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setManualTabungValue("");
    toast.success("Data tabung anggota berhasil dihapus.");
  };

  const handleDeleteAllTabung = async () => {
    const { error } = await supabase
      .from("rekap_iuran_tabung_values")
      .delete()
      .gt("id", 0);

    if (error) {
      toast.error(`Gagal menghapus semua data tabung: ${error.message}`);
      return;
    }

    setTabungValues({});
    setManualTabungValue("");
    setSelectedMemberId("");
    toast.success("Semua data tabung berhasil dihapus.");
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      toast.error("Pilih file Excel terlebih dahulu.");
      return;
    }

    setImporting(true);
    try {
      const parsedRows = await parseTabungExcel(importFile);
      const byMemberId = new Map(agenPsoMembers.map((m) => [m.id, m]));
      const byNoSpbu = new Map(
        agenPsoMembers
          .filter((m) => (m.noSPBU || "").trim().length > 0)
          .map((m) => [String(m.noSPBU).trim().toLowerCase(), m]),
      );
      const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const byNameNorm = new Map(agenPsoMembers.map((m) => [normalizeName(m.namaPT), m]));

      let importedCount = 0;
      const notFound: string[] = [];
      const upsertRows: Array<{
        period_year: number;
        period_month: number;
        member_id: string;
        total_tabung: number;
        created_by_user_id: string;
        created_by_role: "admin" | "bendahara" | "ketua";
      }> = [];

      if (!user?.id || !role) {
        toast.error("Sesi login tidak valid. Silakan login ulang.");
        return;
      }

      setTabungValues((prev) => {
        const next = { ...prev };

        parsedRows.forEach((row, idx) => {
          const matchedMember =
            (row.memberId ? byMemberId.get(row.memberId) : undefined) ||
            (row.noSPBU ? byNoSpbu.get(row.noSPBU.trim().toLowerCase()) : undefined) ||
            (row.namaAgen ? byNameNorm.get(normalizeName(row.namaAgen)) : undefined);

          if (!matchedMember) {
            notFound.push(`Baris ${idx + 1}: Agen "${row.namaAgen || row.noSPBU || row.memberId || "?"}" tidak ditemukan`);
            return;
          }

          const importMonthIndex = MONTHS.findIndex((m) => m.toLowerCase() === row.bulan.toLowerCase());
          if (importMonthIndex < 0) {
            notFound.push(`Baris ${idx + 1}: Bulan "${row.bulan}" tidak valid`);
            return;
          }

          const importYear = row.tahun || tfYear;
          const key = tabungKey(matchedMember.id, importMonthIndex, importYear);
          next[key] = row.totalTabung;
          upsertRows.push({
            period_year: importYear,
            period_month: importMonthIndex + 1,
            member_id: matchedMember.id,
            total_tabung: row.totalTabung,
            created_by_user_id: user.id,
            created_by_role: role,
          });
          importedCount += 1;
        });

        return next;
      });

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("rekap_iuran_tabung_values")
          .upsert(upsertRows, { onConflict: "period_year,period_month,member_id" });

        if (upsertError) {
          toast.error(`Gagal menyimpan hasil import: ${upsertError.message}`);
          return;
        }
      }

      setImportFile(null);

      if (importedCount === 0) {
        toast.error("Tidak ada data yang cocok dengan anggota Agen elpiji PSO.");
        return;
      }

      if (notFound.length > 0) {
        const errorSummary = notFound.slice(0, 3).join("\n");
        const moreThanThree = notFound.length > 3 ? `\n\n(+${notFound.length - 3} error lainnya)` : "";
        toast.warning(`Import selesai: ${importedCount} data masuk.\n\nData tidak cocok:\n${errorSummary}${moreThanThree}`);
      } else {
        toast.success(`Import berhasil: ${importedCount} data total tabung tersimpan.`);
      }
    } catch (error) {
      toast.error(`Gagal import Excel: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSaveToPdf = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `REKAP-IURAN-${tfYear}-${String(tfMonth + 1).padStart(2, "0")}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 8mm; }
      @media print {
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  });

  const handleDownloadExcel = async () => {
    try {
      await downloadRekapIuranExcel({
        title: "REKAP PENERIMAAN IURAN TF DAN IURAN HISWANA",
        subtitle: "ANGGOTA HISWANA MIGAS DPC BANTEN",
        hiswanaLabel: toMonthLabel(hiswanaMonth, hiswanaYear),
        tfLabel: toMonthLabel(tfMonth, tfYear),
        noSpm: noSpm.trim() || undefined,
        expenseLines,
        rows: rows.map((row, index) => ({
          no: index + 1,
          namaAgen: row.namaAgen,
          wilayah: row.wilayah,
          totalTabung: row.totalTabung,
          transportFeeCollected: row.transportFeeCollected,
          hiswanaAmount: row.hiswanaAmount,
          transportFeeReceived: row.transportFeeReceived,
          checked: row.checked,
        })),
        totals,
        totalPendapatan,
        totalPengeluaran,
        saldo,
        formattedToday,
      });
      toast.success("Excel berhasil diunduh.");
    } catch (error) {
      toast.error(`Gagal download Excel: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div className="space-y-1 text-center flex-1">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            REKAP PENERIMAAN IURAN TF DAN IURAN HISWANA
          </h1>
          <p className="text-sm font-semibold text-muted-foreground md:text-base">
            ANGGOTA HISWANA MIGAS DPC BANTEN
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleDownloadExcel}>
            Download Excel
          </Button>
          <Button type="button" variant="outline" onClick={() => handleSaveToPdf()}>
            Cetak / PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Periode Laporan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Iuran Hiswana Bulan</p>
            <Select value={String(hiswanaMonth)} onValueChange={(value) => setHiswanaMonth(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={String(index)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Iuran Hiswana Tahun</p>
            <Select value={String(hiswanaYear)} onValueChange={(value) => setHiswanaYear(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_YEARS.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Iuran TF Bulan</p>
            <Select value={String(tfMonth)} onValueChange={(value) => setTfMonth(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={String(index)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Iuran TF Tahun</p>
            <Select value={String(tfYear)} onValueChange={(value) => setTfYear(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_YEARS.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canShowTabungInputTools && (
            <div className="space-y-2 md:col-span-4">
              <p className="text-xs text-muted-foreground">No SPM (Catatan)</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Contoh: 20/TF/DPC.Banten/III/2026"
                  value={noSpm}
                  onChange={(e) => setNoSpm(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingNoSpm}
                  onClick={async () => {
                    const value = noSpm.trim();
                    if (!value) {
                      toast.error("No SPM tidak boleh kosong.");
                      return;
                    }

                    if (!user?.id || !role) {
                      toast.error("Sesi login tidak valid. Silakan login ulang.");
                      return;
                    }

                    setSavingNoSpm(true);
                    const { error } = await supabase.from("rekap_iuran_spm_notes").insert({
                      period_year: tfYear,
                      period_month: tfMonth + 1,
                      no_spm: value,
                      created_by_user_id: user.id,
                      created_by_role: role,
                    });
                    setSavingNoSpm(false);

                    if (error) {
                      toast.error(`Gagal menyimpan No SPM: ${error.message}`);
                      return;
                    }

                    toast.success(`No SPM disimpan untuk periode ${toMonthLabel(tfMonth, tfYear)}.`);
                  }}
                >
                  {savingNoSpm ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canShowTabungInputTools && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Form Input Total Realisasi / Total Tabung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <div className="space-y-2">
                <Label>Anggota Agen elpiji PSO</Label>
                <Select
                  value={selectedMemberId}
                  onValueChange={(id) => {
                    setSelectedMemberId(id);
                    const existing = tabungValues[tabungKey(id, tfMonth, tfYear)];
                    setManualTabungValue(existing ? String(existing) : "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih anggota" />
                  </SelectTrigger>
                  <SelectContent>
                    {agenPsoMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.namaPT}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Tabung ({toMonthLabel(tfMonth, tfYear)})</Label>
                <Input
                  value={manualTabungValue}
                  onChange={(e) => setManualTabungValue(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Contoh: 120000"
                  inputMode="numeric"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="button" onClick={handleSaveManualTabung} className="w-full md:w-auto">
                  Simpan
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" className="w-full md:w-auto" disabled={!selectedMemberId}>
                      Hapus
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus data tabung?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Data Total Tabung anggota ini untuk bulan {toMonthLabel(tfMonth, tfYear)} akan dihapus.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTabungMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Isi massal dengan Upload Excel</p>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <Input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
                  Download Template
                </Button>
                <Button type="button" onClick={handleImportExcel} disabled={importing}>
                  {importing ? "Import..." : "Import Excel"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Gunakan template kolom: NAMA AGEN, BULAN, JUMLAH TABUNG. BULAN dapat diisi contoh "Maret 2026" atau "Maret" (jika tanpa tahun, otomatis pakai tahun Iuran TF yang aktif).
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-destructive border-destructive hover:bg-destructive/10">
                      Hapus Semua Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus semua data tabung?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Seluruh data Total Tabung dari semua bulan dan anggota akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllTabung} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus Semua</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div
        ref={reportRef}
        className="space-y-4 bg-white text-black p-4 max-w-[297mm] mx-auto font-sans text-[11px] leading-relaxed print:p-0 print:text-[10px]"
      >
      {/* ── Kop Surat (muncul di print) ── */}
      <div className="hidden print:block mb-2">
        <div className="flex items-center gap-3 mb-1">
          <img
            src="/logo-hiswana-512.png"
            alt="Logo"
            className="h-14 w-14 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex-1 text-center">
            <p className="font-extrabold text-[13px] leading-tight tracking-wide">HIMPUNAN WIRASWASTA NASIONAL MINYAK DAN GAS BUMI</p>
            <p className="font-bold text-[11px]">DEWAN PIMPINAN CABANG BANTEN (HISWANA MIGAS)</p>
            <p className="text-[9px] text-gray-600 mt-0.5">Jl. Yusuf Martadilaga No. 42 Serang  |  Telp. (0254) 201453  |  migasbanten@yahoo.com</p>
          </div>
        </div>
        <div className="border-t-4 border-black mb-0.5" />
        <div className="border-t border-black mb-2" />
      </div>

      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          REKAP PENERIMAAN IURAN TF DAN IURAN HISWANA
        </h1>
        <p className="text-sm font-semibold text-muted-foreground md:text-base">
          ANGGOTA HISWANA MIGAS DPC BANTEN
        </p>
      </div>

      <div className="overflow-x-auto print:overflow-visible rounded-lg border border-black bg-white">
        <table className="w-full border-collapse text-[10px] md:text-xs print:text-[9px]">
          <thead>
            <tr>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-2 py-0.5 print:py-0 text-center font-bold">No</th>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[26%]">Nama Agen</th>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[14%]">Wilayah</th>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[13%]">Total Tabung</th>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[14%]">Jumlah Pemungutan Transport Fee</th>
              <th colSpan={2} className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold">Total Iuran</th>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[6%]">Catatan</th>
              <th rowSpan={3} className="border border-black bg-[#92d050] px-2 py-0.5 print:py-0 text-center font-bold print:hidden w-[5%]">Aksi</th>
            </tr>
            <tr>
              <th className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[13.5%]">Iuran Hiswana</th>
              <th className="border border-black bg-[#92d050] px-3 py-0.5 print:py-0 text-center font-bold w-[13.5%]">Iuran Transport Fee</th>
            </tr>
            <tr>
              <th className="border border-black bg-[#7030a0] px-3 py-0.5 print:py-0 text-center font-semibold text-white">
                {toMonthLabel(hiswanaMonth, hiswanaYear)}
              </th>
              <th className="border border-black bg-[#7030a0] px-3 py-0.5 print:py-0 text-center font-semibold text-white">
                {toMonthLabel(tfMonth, tfYear)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="print:h-[14.4pt]">
                <td className="border border-black px-2 py-1 print:py-0 text-center">{index + 1}</td>
                <td className="border border-black px-3 py-1 print:py-0.5 font-medium">{row.namaAgen}</td>
                <td className="border border-black px-3 py-1 print:py-0.5">{row.wilayah}</td>
                <td className="border border-black px-2 py-0.5 print:py-0 text-right">
                  <Input
                    value={formatNumberInput(row.totalTabung)}
                    onChange={(event) => handleTabungChange(row.id, event.target.value)}
                    onBlur={async (event) => {
                      const value = Number(event.target.value.replace(/[^0-9]/g, "")) || 0;
                      await saveTabungValue(row.id, value);
                    }}
                    inputMode="numeric"
                    placeholder="Input total tabung"
                    className="h-8 rounded-none border-0 px-2 text-right shadow-none focus-visible:ring-0 print:hidden"
                  />
                  <span className="hidden print:inline">{row.totalTabung > 0 ? row.totalTabung.toLocaleString("id-ID") : "-"}</span>
                </td>
                <td className="border border-black px-3 py-1 print:py-0.5 text-right font-medium">
                  {row.transportFeeCollected > 0 ? formatCurrency(row.transportFeeCollected) : "-"}
                </td>
                <td className="border border-black px-3 py-1 print:py-0.5 text-right font-medium">
                  {row.hiswanaAmount > 0 ? formatCurrency(row.hiswanaAmount) : "-"}
                </td>
                <td className="border border-black px-3 py-1 print:py-0.5 text-right font-medium">
                  {row.transportFeeReceived > 0 ? formatCurrency(row.transportFeeReceived) : "-"}
                </td>
                <td className="border border-black px-3 py-1 print:py-0.5 text-center">
                  <div className="flex justify-center">
                    <Checkbox checked={row.checked} disabled className="h-3.5 w-3.5 border-black data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white print:hidden" />
                    <span className="hidden print:inline">{row.checked ? "v" : "-"}</span>
                  </div>
                </td>
                <td className="border border-black px-1 py-1 print:hidden text-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus data tabung?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Data Total Tabung <span className="font-semibold">{row.namaAgen}</span> untuk bulan {toMonthLabel(tfMonth, tfYear)} akan dihapus.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            const deleted = await saveTabungValue(row.id, 0);
                            if (!deleted) return;

                            const key = tabungKey(row.id, tfMonth, tfYear);
                            setTabungValues((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                            toast.success(`Data tabung ${row.namaAgen} berhasil dihapus.`);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
            <tr className="bg-[#f3f9e7] font-bold print:h-[14.4pt]">
              <td colSpan={3} className="border border-black px-3 py-1 print:py-0 text-right">JUMLAH</td>
              <td className="border border-black px-3 py-1 print:py-0.5 text-right">{totals.totalTabung > 0 ? totals.totalTabung.toLocaleString("id-ID") : "-"}</td>
              <td className="border border-black px-3 py-1 print:py-0.5 text-right">{formatCurrency(totals.transportFeeCollected)}</td>
              <td className="border border-black px-3 py-1 print:py-0.5 text-right">{formatCurrency(totals.hiswanaAmount)}</td>
              <td className="border border-black px-3 py-1 print:py-0.5 text-right">{formatCurrency(totals.transportFeeReceived)}</td>
              <td className="border border-black px-3 py-1 print:py-0.5 text-center">
                <Checkbox checked={rows.some((row) => row.checked)} disabled className="h-3.5 w-3.5 border-black data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white print:hidden" />
                <span className="hidden print:inline">{rows.some((row) => row.checked) ? "v" : "-"}</span>
              </td>
              <td className="border border-black px-1 py-1 print:hidden" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px] print:grid-cols-[1fr_220px] text-sm">
        <div className="space-y-1">
          <p className="text-base font-semibold">Catatan</p>
          <p className="leading-tight">
            Pengeluaran ini dikeluarkan dengan No SPM tertentu
            {noSpm && <span className="font-semibold"> (No SPM: {noSpm})</span>}
          </p>
          <div className="space-y-0.5">
            <p className="font-semibold">Rincian Pengeluaran:</p>
            {expenseLines.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3">
                <span>{item.label}</span>
                <span className="font-medium">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-black pt-1 font-semibold">
            <span>Total Pengeluaran</span>
            <span>{formatCurrency(totalPengeluaran)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold">Rekapitulasi</p>
          <div className="flex items-center justify-between gap-3">
            <span>Pendapatan</span>
            <span className="font-medium">{formatCurrency(totalPendapatan)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Pengeluaran</span>
            <span className="font-medium">{formatCurrency(totalPengeluaran)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-black pt-1 font-semibold">
            <span>Saldo</span>
            <span>{formatCurrency(saldo)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-10 pt-6 md:grid-cols-2 print:grid-cols-2 print:gap-4 print:pt-3">
        <div className="space-y-16 text-sm">
          <div>
            <p>Mengetahui</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold underline">H. Arie Setiawan</p>
            <p>Wakil Bendahara</p>
          </div>
        </div>
        <div className="space-y-16 text-right text-sm">
          <div>
            <p>Serang, {formattedToday}</p>
            <p>Dilaporkan oleh</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold underline">Uus</p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default RekapIuran;
