import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIncomes } from "@/lib/income-context";
import { useMembers } from "@/lib/member-context";

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

type ParsedNote = {
  text: string;
  amount: number | null;
  month: string | null;
  year: number | null;
};

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
    // Backward compatibility for legacy plain-text notes.
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

const REPORT_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const RekapIuranSeluruhAnggota = () => {
  const { incomes } = useIncomes();
  const { members } = useMembers();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [search, setSearch] = useState("");
  const [bidangUsahaFilter, setBidangUsahaFilter] = useState("all");

  const bidangUsahaOptions = useMemo(() => {
    const unique = new Set(
      members
        .map((member) => member.bidangUsaha?.trim())
        .filter((value): value is string => Boolean(value)),
    );

    return [...unique].sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [members]);

  const rows = useMemo(() => {
    const sortedMembers = members
      .slice()
      .sort((a, b) => a.namaPT.localeCompare(b.namaPT, "id-ID"));

    return sortedMembers
      .map((member) => {
        const memberIncomes = incomes.filter(
          (income) => income.memberId === member.id && income.status === "lunas",
        );

        const monthlyStatus = MONTHS.map((monthLabel) => {
          const hiswanaAmount = memberIncomes.reduce(
            (sum, income) => sum + getIncomeComponentAmount(income, "hiswana", monthLabel, year),
            0,
          );

          const paidHiswana = hiswanaAmount > 0;
          const amount = hiswanaAmount;
          const paid = paidHiswana;

          return {
            monthLabel,
            paid,
            amount,
          };
        });

        const paidMonths = monthlyStatus.filter((item) => item.paid).length;
        const unpaidMonths = 12 - paidMonths;

        return {
          id: member.id,
          namaPT: member.namaPT,
          noSPBU: member.noSPBU || null,
          wilayah: member.wilayah || "-",
          bidangUsaha: member.bidangUsaha || "-",
          memberStatus: member.status,
          monthlyStatus,
          paidMonths,
          unpaidMonths,
          status: paidMonths === 12 ? "Lunas Tahunan" : "Belum Lunas",
        };
      })
      .filter((row) => {
        const matchBidangUsaha =
          bidangUsahaFilter === "all" || row.bidangUsaha.toLowerCase() === bidangUsahaFilter.toLowerCase();
        if (!matchBidangUsaha) return false;

        if (!search.trim()) return true;
        const keyword = search.trim().toLowerCase();
        return (
          row.namaPT.toLowerCase().includes(keyword) ||
          row.wilayah.toLowerCase().includes(keyword) ||
          row.bidangUsaha.toLowerCase().includes(keyword) ||
          (row.noSPBU || '').toLowerCase().includes(keyword)
        );
      });
  }, [bidangUsahaFilter, incomes, members, search, year]);

  const totalMembers = rows.length;
  const totalPaid = rows.filter((row) => row.status === "Lunas Tahunan").length;
  const totalUnpaid = totalMembers - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rekap Iuran Seluruh Anggota</h1>
        <p className="text-muted-foreground">Pantau status Iuran Hiswana setiap anggota dari Januari sampai Desember.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Rekap Tahunan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">

          <div className="space-y-2">
            <p className="text-sm font-medium">Tahun</p>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih tahun" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_YEARS.map((item) => (
                  <SelectItem key={item} value={String(item)}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Bidang Usaha</p>
            <Select value={bidangUsahaFilter} onValueChange={setBidangUsahaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih bidang usaha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bidang Usaha</SelectItem>
                {bidangUsahaOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Cari Anggota</p>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama PT / wilayah"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Anggota</p>
            <p className="text-2xl font-bold">{totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sudah Bayar</p>
            <p className="text-2xl font-bold text-emerald-600">{totalPaid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Belum Bayar</p>
            <p className="text-2xl font-bold text-rose-600">{totalUnpaid}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Daftar Seluruh Anggota - Januari s.d. Desember {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1900px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="border px-3 py-2 text-left">No</th>
                  <th className="border px-3 py-2 text-left">Nama Anggota</th>
                  <th className="border px-3 py-2 text-left">Wilayah</th>
                  <th className="border px-3 py-2 text-left">Bidang Usaha</th>
                  <th className="border px-3 py-2 text-center">Status Anggota</th>
                  {MONTHS.map((monthLabel) => (
                    <th key={monthLabel} className="border px-2 py-2 text-center">
                      {monthLabel.slice(0, 3)}
                    </th>
                  ))}
                  <th className="border px-3 py-2 text-center">Bulan Bayar</th>
                  <th className="border px-3 py-2 text-center">Bulan Belum</th>
                  <th className="border px-3 py-2 text-center">Status Akhir</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="border px-3 py-8 text-center text-muted-foreground">
                      Tidak ada data anggota untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="border px-3 py-2">{index + 1}</td>
                      <td className="border px-3 py-2 font-medium">
                          {row.namaPT}
                          {row.noSPBU && row.bidangUsaha.toLowerCase().includes('spbu') && (
                            <div className="text-xs text-muted-foreground font-normal">No. SPBU: {row.noSPBU}</div>
                          )}
                        </td>
                      <td className="border px-3 py-2">{row.wilayah}</td>
                      <td className="border px-3 py-2">{row.bidangUsaha}</td>
                      <td className="border px-3 py-2 text-center">
                        <Badge variant={row.memberStatus === "active" ? "default" : "secondary"}>
                          {row.memberStatus === "active" ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      {row.monthlyStatus.map((item) => (
                        <td key={`${row.id}-${item.monthLabel}`} className="border px-2 py-2 text-right font-medium">
                          {item.paid ? item.amount.toLocaleString("id-ID") : "0"}
                        </td>
                      ))}
                      <td className="border px-3 py-2 text-center font-semibold text-emerald-700">{row.paidMonths}</td>
                      <td className="border px-3 py-2 text-center font-semibold text-rose-700">{row.unpaidMonths}</td>
                      <td className="border px-3 py-2 text-center">
                        <Badge
                          variant={row.status === "Lunas Tahunan" ? "default" : "secondary"}
                          className={row.status === "Lunas Tahunan" ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                        >
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RekapIuranSeluruhAnggota;
