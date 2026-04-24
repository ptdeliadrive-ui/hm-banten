import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Link as LinkIcon, Download, Upload } from "lucide-react";
import { formatCurrency, type Income } from "@/lib/store";
import { useIncomes } from "@/lib/income-context";
import { useMembers } from "@/lib/member-context";
import { deletePaymentProofFromStorage, uploadPaymentProof } from "@/lib/payment-proof";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { parsePemasukanExcel, downloadPemasukanTemplate } from "@/lib/excel-parser";

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const NOTE_TEXT_SUGGESTIONS = ["IURAN HISWANA", "IURAN TRANSPORT FEE"];

type IncomeNoteItemInput = {
  text: string;
  amount: string;
  month: string;
  year: string;
};

type IncomeNoteItemParsed = {
  text: string;
  amount: number | null;
  month: string;
  year: number | null;
};

function parseAmountInput(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function parseIncomeNotes(raw?: string): IncomeNoteItemInput[] {
  const value = (raw || "").trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const normalized: IncomeNoteItemInput[] = parsed
        .map((item) => {
          if (typeof item === "string") {
            const text = item.trim();
            if (!text) return null;
            return { text, amount: "", month: "", year: "" };
          }

          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            const text = String(obj.text ?? obj.label ?? obj.keterangan ?? "").trim();
            const rawAmount = obj.amount ?? obj.nominal;
            const amount = rawAmount === null || rawAmount === undefined ? "" : String(rawAmount).replace(/[^0-9]/g, "");
            const monthRaw = obj.month ?? obj.bulan ?? obj.periodMonth;
            const yearRaw = obj.year ?? obj.tahun ?? obj.periodYear;
            const month = monthRaw === null || monthRaw === undefined ? "" : String(monthRaw).trim();
            const year = yearRaw === null || yearRaw === undefined ? "" : String(yearRaw).replace(/[^0-9]/g, "");
            if (!text) return null;
            return { text, amount, month, year };
          }

          return null;
        })
        .filter((item): item is IncomeNoteItemInput => Boolean(item));

      return normalized;
    }
  } catch {
    // Keep backward compatibility for legacy plain text notes.
  }

  return [{ text: value, amount: "", month: "", year: "" }];
}

function serializeIncomeNotes(items: IncomeNoteItemInput[]): string {
  const normalized = items
    .map((item) => ({
      text: item.text.trim(),
      amount: parseAmountInput(item.amount),
      month: item.month.trim(),
      year: Number(item.year),
    }))
    .filter((item) => item.text.length > 0);

  if (normalized.length === 0) return "";
  if (
    normalized.length === 1 &&
    normalized[0].amount <= 0 &&
    !normalized[0].month &&
    !Number.isFinite(normalized[0].year)
  ) {
    return normalized[0].text;
  }

  return JSON.stringify(
    normalized.map((item) => ({
      text: item.text,
      amount: item.amount > 0 ? item.amount : null,
      month: item.month || null,
      year: Number.isFinite(item.year) && item.year > 0 ? item.year : null,
    }))
  );
}

function parseIncomeNotesForDisplay(raw?: string): IncomeNoteItemParsed[] {
  return parseIncomeNotes(raw)
    .map((item) => {
      const text = item.text.trim();
      if (!text) return null;
      const amountNum = parseAmountInput(item.amount);
      return {
        text,
        amount: amountNum > 0 ? amountNum : null,
        month: item.month,
        year: Number(item.year) > 0 ? Number(item.year) : null,
      };
    })
    .filter((item): item is IncomeNoteItemParsed => Boolean(item));
}

const Pemasukan = () => {
  const { role } = useAuth();
  const { members } = useMembers();
  const { incomes, setIncomes } = useIncomes();
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Income>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formAmount, setFormAmount] = useState<number>(100000);
  const [downloadingProofId, setDownloadingProofId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [noteItems, setNoteItems] = useState<IncomeNoteItemInput[]>([{ text: "", amount: "", month: "", year: "" }]);
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const canManagePemasukan = role === "admin";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = incomes
    .filter(i => {
      const matchSearch = !search ||
        i.memberName.toLowerCase().includes(search.toLowerCase()) ||
        i.month.toLowerCase().includes(search.toLowerCase());
      const payDate = i.date ? new Date(i.date) : null;
      const payMonthLabel = payDate ? MONTHS[payDate.getMonth()] : null;
      const payYear = payDate ? String(payDate.getFullYear()) : null;
      const matchMonth = !filterMonth || payMonthLabel === filterMonth;
      const matchYear = !filterYear || payYear === filterYear;
      return matchSearch && matchMonth && matchYear;
    })
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : new Date(a.year, MONTHS.indexOf(a.month), 1).getTime();
      const db = b.date ? new Date(b.date).getTime() : new Date(b.year, MONTHS.indexOf(b.month), 1).getTime();
      return db - da;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, i) => s + i.amount, 0);

  const handleFilterChange = (cb: () => void) => { cb(); setPage(1); };

  function formatTanggal(dateStr?: string) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  const resetForm = () => {
    setEditId(null);
    setFormData({});
    setFormAmount(100000);
    setMemberSearch("");
    setSelectedMemberId("");
    setNoteItems([{ text: "", amount: "", month: "", year: "" }]);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (income: Income) => {
    setEditId(income.id);
    setFormData(income);
    setSelectedMemberId(income.memberId || "");
    const member = members.find(m => m.id === income.memberId);
    setMemberSearch(member ? member.namaPT : "");
    setFormAmount(income.amount || 100000);
    const parsedNotes = parseIncomeNotes(income.notes || "");
    setNoteItems(
      parsedNotes.length > 0
        ? parsedNotes.map((item) => ({
            ...item,
            month: item.month || income.month || "",
            year: item.year || String(income.year || ""),
          }))
        : [{ text: "", amount: "", month: income.month || "", year: String(income.year || "") }],
    );
    setOpen(true);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const member = members.find(m => m.id === fd.get('memberId'));
    const proofFile = fd.get("paymentProof") as File | null;

    let proofUrl = formData.proofUrl || "";
    let proofFileId = formData.proofFileId || "";
    let proofFileName = formData.proofFileName || "";

    setSaving(true);

    if (proofFile && proofFile.size > 0) {
      try {
        const uploaded = await uploadPaymentProof(
          proofFile,
          member?.namaPT || member?.id || "anggota",
          (fd.get("date") as string) || "",
        );

        if (editId && formData.proofFileId && formData.proofFileId !== uploaded.fileId) {
          await deletePaymentProofFromStorage(formData.proofFileId);
        }

        proofUrl = uploaded.webViewLink;
        proofFileId = uploaded.fileId;
        proofFileName = uploaded.fileName;
      } catch (uploadError) {
        toast.error(`Gagal upload bukti bayar: ${uploadError instanceof Error ? uploadError.message : "unknown error"}`);
        setSaving(false);
        return;
      }
    }

    const totalAmount = Number(fd.get('amount')) || 0;
    const defaultMonth = String(fd.get('month') || '');
    const defaultYear = String(fd.get('year') || '');
    const normalizedNoteItems = noteItems.map((item) => ({
      ...item,
      month: item.month || defaultMonth,
      year: item.year || defaultYear,
    }));

    const filledNotes = normalizedNoteItems.filter((item) => item.text.trim().length > 0);
    const notesTotal = filledNotes.reduce((sum, item) => sum + parseAmountInput(item.amount), 0);
    const hasAnyNoteAmount = filledNotes.some((item) => parseAmountInput(item.amount) > 0);

    if (hasAnyNoteAmount && notesTotal !== totalAmount) {
      toast.error(`Total nominal keterangan (${formatCurrency(notesTotal)}) harus sama dengan jumlah pemasukan (${formatCurrency(totalAmount)}).`);
      setSaving(false);
      return;
    }

    const newIncome: Income = {
      id: editId || String(Date.now()),
      memberId: fd.get('memberId') as string,
      memberName: member?.namaPT || '',
      date: fd.get('date') as string,
      amount: totalAmount,
      month: fd.get('month') as string,
      year: Number(fd.get('year')),
      status: fd.get('status') as 'lunas' | 'belum',
      notes: serializeIncomeNotes(normalizedNoteItems),
      proofUrl,
      proofFileId,
      proofFileName,
    };

    if (editId) {
      setIncomes(incomes.map(i => i.id === editId ? newIncome : i));
      toast.success("Pemasukan berhasil diperbarui");
    } else {
      setIncomes([newIncome, ...incomes]);
      toast.success("Pemasukan berhasil ditambahkan");
    }
    setSaving(false);
    setOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setIncomes(incomes.filter(i => i.id !== id));
    toast.success("Pemasukan berhasil dihapus");
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      toast.error("Pilih file Excel terlebih dahulu.");
      return;
    }
    setImporting(true);
    try {
      const rows = await parsePemasukanExcel(importFile);
      const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const byNameNorm = new Map(members.map((m) => [normalizeName(m.namaPT), m]));

      const newIncomes: Income[] = [];
      const notFound: string[] = [];

      rows.forEach((row, idx) => {
        const member = byNameNorm.get(normalizeName(row.namaAgen));
        if (!member) {
          notFound.push(`baris ${idx + 1} (${row.namaAgen})`);
          return;
        }

        const keterangan = row.keterangan.trim();
        const notes = keterangan
          ? JSON.stringify([{ text: keterangan, amount: row.jumlah, month: row.bulan, year: row.tahun }])
          : "";

        newIncomes.push({
          id: `${Date.now()}-${idx}`,
          memberId: member.id,
          memberName: member.namaPT,
          date: row.tanggal,
          amount: row.jumlah,
          month: row.bulan,
          year: row.tahun,
          status: row.status,
          notes,
          proofUrl: "",
          proofFileId: "",
          proofFileName: "",
        });
      });

      if (newIncomes.length > 0) {
        setIncomes((prev) => [...newIncomes, ...prev]);
      }

      setImportFile(null);
      if (importFileRef.current) importFileRef.current.value = "";

      if (newIncomes.length === 0) {
        toast.error("Tidak ada data yang cocok dengan anggota terdaftar.");
      } else if (notFound.length > 0) {
        toast.warning(`Import selesai: ${newIncomes.length} data masuk, ${notFound.length} tidak cocok: ${notFound.join(", ")}.`);
      } else {
        toast.success(`Import berhasil: ${newIncomes.length} pemasukan ditambahkan.`);
      }
    } catch (err) {
      toast.error(`Gagal import: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadProof = async (income: Income) => {
    if (!income.proofUrl) {
      toast.error("Bukti bayar tidak tersedia");
      return;
    }

    setDownloadingProofId(income.id);

    try {
      const response = await fetch(income.proofUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = income.proofFileName || `bukti-bayar-${income.memberName || income.id}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(`Gagal download bukti bayar: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setDownloadingProofId(null);
    }
  };

  const updateNoteText = (index: number, value: string) => {
    setNoteItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, text: value } : item)));
  };

  const updateNoteAmount = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    const filledAmount = Number(numeric) || 0;
    const total = formAmount;

    setNoteItems((prev) => {
      const next = prev.map((item, idx) => (idx === index ? { ...item, amount: numeric } : item));
      // Auto-fill the other item when exactly 2 items
      if (next.length === 2 && total > 0) {
        const otherIdx = index === 0 ? 1 : 0;
        const remainder = Math.max(0, total - filledAmount);
        next[otherIdx] = { ...next[otherIdx], amount: String(remainder) };
      }
      return next;
    });
  };

  const updateNoteMonth = (index: number, value: string) => {
    setNoteItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, month: value } : item)));
  };

  const updateNoteYear = (index: number, value: string) => {
    setNoteItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, year: value.replace(/[^0-9]/g, "") } : item)));
  };

  const applyNoteTextSuggestion = (index: number, text: string) => {
    setNoteItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, text } : item)));
  };

  const addNoteItem = () => {
    setNoteItems((prev) => [...prev, { text: "", amount: "", month: formData.month || "", year: formData.year ? String(formData.year) : "" }]);
  };

  const removeNoteItem = (index: number) => {
    setNoteItems((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length > 0 ? next : [{ text: "", amount: "", month: formData.month || "", year: formData.year ? String(formData.year) : "" }];
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pemasukan</h2>
          <p className="text-sm text-muted-foreground">Pencatatan iuran anggota</p>
        </div>
        {canManagePemasukan && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadPemasukanTemplate(members.filter(m => m.status === "active").map(m => m.namaPT))}
            >
              <Download className="mr-2 h-4 w-4" />Template Excel
            </Button>
            <div className="flex items-center gap-1">
              <Input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.csv"
                className="w-48 cursor-pointer text-sm"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <Button type="button" onClick={handleImportExcel} disabled={importing || !importFile} variant="outline">
                <Upload className="mr-2 h-4 w-4" />{importing ? "Import..." : "Import"}
              </Button>
            </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Tambah Pemasukan</Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto max-sm:w-screen max-sm:h-screen max-sm:max-w-none max-sm:max-h-none max-sm:rounded-none max-sm:border-0">
              <DialogHeader>
                <DialogTitle>{editId ? 'Edit Pemasukan' : 'Tambah Pemasukan Baru'}</DialogTitle>
                <DialogDescription>
                  Isi data pemasukan anggota dan upload bukti bayar/transfer bila tersedia.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Anggota</Label>
                <div className="relative" ref={memberDropdownRef}>
                  <input type="hidden" name="memberId" value={selectedMemberId} required />
                  <Input
                    placeholder="Cari Nama PT atau No SPBU..."
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setMemberDropdownOpen(true); setSelectedMemberId(""); }}
                    onFocus={() => setMemberDropdownOpen(true)}
                    autoComplete="off"
                  />
                  {memberDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-52 overflow-auto rounded-md border bg-popover shadow-md">
                      {members
                        .filter(m => m.status === 'active' && (
                          m.namaPT.toLowerCase().includes(memberSearch.toLowerCase()) ||
                          (m.noSPBU || '').toLowerCase().includes(memberSearch.toLowerCase())
                        ))
                        .map(m => (
                          <button
                            key={m.id}
                            type="button"
                            className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => { setSelectedMemberId(m.id); setMemberSearch(m.namaPT); setMemberDropdownOpen(false); }}
                          >
                            <span className="font-medium">{m.namaPT}</span>
                            {m.noSPBU && <span className="text-xs text-muted-foreground">No SPBU: {m.noSPBU}</span>}
                          </button>
                        ))}
                      {members.filter(m => m.status === 'active' && (
                        m.namaPT.toLowerCase().includes(memberSearch.toLowerCase()) ||
                        (m.noSPBU || '').toLowerCase().includes(memberSearch.toLowerCase())
                      )).length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bulan (Default)</Label>
                  <Select name="month" defaultValue={formData.month || ''} required>
                    <SelectTrigger><SelectValue placeholder="Bulan" /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun (Default)</Label>
                  <Input name="year" type="number" defaultValue={formData.year || 2025} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Bayar</Label>
                  <Input name="date" type="date" defaultValue={formData.date || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input
                    name="amount"
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select name="status" defaultValue={formData.status || 'lunas'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunas">Lunas</SelectItem>
                    <SelectItem value="belum">Belum Bayar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <div className="space-y-2">
                  {noteItems.map((item, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="space-y-1">
                        <Input
                          value={item.text}
                          onChange={(e) => updateNoteText(idx, e.target.value)}
                          placeholder={idx === 0 ? "Contoh: IURAN HISWANA" : "Contoh: IURAN TRANSPORT FEE"}
                          list="note-text-suggestions"
                        />
                        <div className="flex flex-wrap gap-1">
                          {NOTE_TEXT_SUGGESTIONS.map((suggestion) => (
                            <Button
                              key={`${idx}-${suggestion}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => applyNoteTextSuggestion(idx, suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Input
                          value={item.amount}
                          onChange={(e) => updateNoteAmount(idx, e.target.value)}
                          placeholder="Nominal (contoh 100000)"
                          inputMode="numeric"
                        />
                        <Select value={item.month || "default"} onValueChange={(v) => updateNoteMonth(idx, v === "default" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Bulan item" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            {MONTHS.map((m) => <SelectItem key={`${idx}-${m}`} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          value={item.year}
                          onChange={(e) => updateNoteYear(idx, e.target.value)}
                          placeholder="Tahun"
                          inputMode="numeric"
                        />
                      </div>
                      {noteItems.length > 1 && (
                        <div className="flex justify-end">
                          <Button type="button" variant="outline" size="sm" onClick={() => removeNoteItem(idx)}>
                            Hapus
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={addNoteItem}>
                    + Tambah Keterangan
                  </Button>
                  <datalist id="note-text-suggestions">
                    {NOTE_TEXT_SUGGESTIONS.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-muted-foreground">
                    Per item bisa beda periode (bulan/tahun). Jika kosong, otomatis pakai periode default di atas.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Jika nominal per keterangan diisi, total nominal keterangan harus sama dengan jumlah pemasukan.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bukti Bayar / Transfer</Label>
                <Input name="paymentProof" type="file" accept="image/*,.pdf" />
                {formData.proofUrl && (
                  <a href={formData.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Lihat bukti saat ini
                  </a>
                )}
                <p className="text-[11px] text-muted-foreground">File disimpan di Supabase Storage. Format: JPG, PNG, WEBP, PDF. Maksimal 1MB. Jika gambar lebih dari 1MB, aplikasi akan kompres otomatis.</p>
              </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Menyimpan..." : (editId ? 'Simpan Perubahan' : 'Simpan')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama..." value={search} onChange={e => handleFilterChange(() => setSearch(e.target.value))} className="max-w-xs" />
            <Select value={filterMonth || "all"} onValueChange={v => handleFilterChange(() => setFilterMonth(v === "all" ? "" : v))}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Semua Bulan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bulan</SelectItem>
                {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Tahun" value={filterYear} onChange={e => handleFilterChange(() => setFilterYear(e.target.value))} className="w-24" type="number" />
            {(filterMonth || filterYear || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterMonth(""); setFilterYear(""); setSearch(""); setPage(1); }}>Reset</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1 text-sm text-muted-foreground">
            <span>
              Menampilkan{" "}
              <span className="font-medium text-foreground">
                {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              dari <span className="font-medium text-foreground">{filtered.length}</span> entri
            </span>
            <span>
              Total:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Anggota</TableHead>
                <TableHead>Bulan</TableHead>
                <TableHead>Tanggal Bayar</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Bukti</TableHead>
                {canManagePemasukan && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((inc) => {
                const noteDetails = parseIncomeNotesForDisplay(inc.notes);
                return (
                <TableRow key={inc.id}>
                  <TableCell className="font-medium">{inc.memberName}</TableCell>
                  <TableCell>{inc.month} {inc.year}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatTanggal(inc.date)}</TableCell>
                  <TableCell>{formatCurrency(inc.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={inc.status === 'lunas' ? 'default' : 'destructive'}>
                      {inc.status === 'lunas' ? 'Lunas' : 'Belum'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {noteDetails.length > 0 ? (
                      <div className="space-y-1">
                        {noteDetails.map((note, idx) => (
                          <div key={`${inc.id}-note-${idx}`} className="text-xs leading-5">
                            • {note.text}
                            {note.month && note.year ? ` [${note.month} ${note.year}]` : ""}
                            {note.amount ? ` (${formatCurrency(note.amount)})` : ""}
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {inc.proofUrl ? (
                      <div className="flex items-center gap-3">
                        <a href={inc.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                          <LinkIcon className="h-3 w-3" /> Lihat
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDownloadProof(inc)}
                          className="inline-flex items-center gap-1 text-primary underline disabled:pointer-events-none disabled:opacity-60"
                          disabled={downloadingProofId === inc.id}
                        >
                          <Download className="h-3 w-3" /> {downloadingProofId === inc.id ? "Mengunduh..." : "Download"}
                        </button>
                      </div>
                    ) : '-'}
                  </TableCell>
                  {canManagePemasukan && (
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(inc)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(inc.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )})}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Halaman {safePage} dari {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(1)}>«</Button>
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "...")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={safePage === p ? "default" : "outline"}
                        size="sm"
                        className="w-9"
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</Button>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pemasukan;
