import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, CreditCard, Upload } from "lucide-react";
import { type SavedAccount, BANK_CODES } from "@/lib/spm-store";
import { parseRekeningExcel, downloadRekeningTemplate, type RekenigRow } from "@/lib/excel-parser";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function normalizeBankInput(bankInput: string) {
  const raw = bankInput.trim();
  if (!raw) return null;

  // Accept numeric variants like 2, 02, or 002 for bank code inputs.
  if (/^\d+$/.test(raw)) {
    const normalizedCode = raw.padStart(3, "0");
    const byNumericCode = BANK_CODES.find((b) => b.code === normalizedCode);
    if (byNumericCode) return byNumericCode;
  }

  const upper = raw.toUpperCase();
  const byCode = BANK_CODES.find((b) => b.code === upper);
  if (byCode) return byCode;

  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  const aliases: Record<string, string> = {
    MANDIRI: "001",
    BANKMANDIRI: "001",
    BCA: "002",
    BANKBCA: "002",
    BCAPERSERO: "002",
    BRI: "003",
    BANKBRI: "003",
    BRIAGRO: "003",
    BNI: "004",
    BANKBNI: "004",
    BSI: "008",
    BANKSYARIAHINDONESIA: "008",
    SYARIAHINDONESIA: "008",
    BANKSYARIAH: "008",
    MUAMALAT: "009",
    BANKMUAMALAT: "009",
    DANAMON: "011",
    BANKDANAMON: "011",
    PERMATA: "013",
    BANKPERMATA: "013",
    BCASYARIAH: "014",
    BANKBCASYARIAH: "014",
    MAYBANK: "016",
    BANKMAYBANK: "016",
  };

  const mappedCode = aliases[cleaned];
  if (!mappedCode) return null;

  return BANK_CODES.find((b) => b.code === mappedCode) || null;
}

const MasterRekening = () => {
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ bankCode: '', rekening: '', atasNama: '' });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const refresh = async () => {
    const { data, error } = await supabase.from("saved_accounts").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal mengambil data rekening");
      return;
    }

    setAccounts((data || []).map((row) => ({
      id: row.id,
      bankCode: row.bank_code,
      bankName: row.bank_name,
      rekening: row.rekening,
      atasNama: row.atas_nama,
    })));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ bankCode: '', rekening: '', atasNama: '' });
    setDialogOpen(true);
  };

  const openEdit = (acc: SavedAccount) => {
    setEditId(acc.id);
    setForm({ bankCode: acc.bankCode, rekening: acc.rekening, atasNama: acc.atasNama });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bankCode || !form.rekening || !form.atasNama) {
      toast.error("Semua field wajib diisi");
      return;
    }
    const bank = BANK_CODES.find(b => b.code === form.bankCode);

    if (editId) {
      const { error } = await supabase
        .from("saved_accounts")
        .update({
          bank_code: form.bankCode,
          bank_name: bank?.name || '',
          rekening: form.rekening,
          atas_nama: form.atasNama,
        })
        .eq("id", editId);

      if (error) {
        toast.error("Gagal memperbarui rekening");
        return;
      }

      toast.success("Rekening berhasil diperbarui");
    } else {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const { error } = await supabase.from("saved_accounts").insert({
        id,
        bank_code: form.bankCode,
        bank_name: bank?.name || '',
        rekening: form.rekening,
        atas_nama: form.atasNama,
      });

      if (error) {
        toast.error("Gagal menambahkan rekening");
        return;
      }

      toast.success("Rekening berhasil ditambahkan");
    }
    await refresh();
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_accounts").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus rekening");
      return;
    }

    await refresh();
    toast.success("Rekening berhasil dihapus");
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Pilih file Excel terlebih dahulu");
      return;
    }

    setImportLoading(true);
    try {
      const rows = await parseRekeningExcel(importFile);

      const payload: Array<{ id: string; bank_code: string; bank_name: string; rekening: string; atas_nama: string }> = [];

      rows.forEach((row, idx) => {
        const bank = normalizeBankInput(row.bankCode);
        if (!bank) {
          throw new Error(`Baris ${idx + 1}: Bank '${row.bankCode}' tidak dikenali. Gunakan kode atau nama bank yang valid.`);
        }

        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${idx}`;

        payload.push({
          id,
          bank_code: bank.code,
          bank_name: bank.name,
          rekening: row.rekening,
          atas_nama: row.atasNama,
        });
      });

      // De-duplicate incoming rows by bank+rekening to avoid processing the same account twice.
      const dedupMap = new Map<string, { id: string; bank_code: string; bank_name: string; rekening: string; atas_nama: string }>();
      payload.forEach((row) => {
        const key = `${row.bank_code}|${row.rekening}`;
        dedupMap.set(key, row);
      });
      const dedupPayload = Array.from(dedupMap.values());

      const { data: existingRows, error: existingError } = await supabase
        .from("saved_accounts")
        .select("id, bank_code, rekening");

      if (existingError) {
        throw new Error(`Gagal membaca data rekening yang sudah ada: ${existingError.message}`);
      }

      const existingMap = new Map<string, string>();
      (existingRows || []).forEach((row) => {
        const key = `${row.bank_code}|${row.rekening}`;
        existingMap.set(key, row.id);
      });

      const toInsert: Array<{ id: string; bank_code: string; bank_name: string; rekening: string; atas_nama: string }> = [];
      const toUpdate: Array<{ id: string; bank_code: string; bank_name: string; rekening: string; atas_nama: string }> = [];

      dedupPayload.forEach((row) => {
        const key = `${row.bank_code}|${row.rekening}`;
        const existingId = existingMap.get(key);
        if (existingId) {
          toUpdate.push({ ...row, id: existingId });
        } else {
          toInsert.push(row);
        }
      });

      if (toInsert.length > 0) {
        const { error } = await supabase.from("saved_accounts").insert(toInsert);
        if (error) {
          throw new Error(`Gagal menambah data rekening baru: ${error.message}`);
        }
      }

      if (toUpdate.length > 0) {
        const { error } = await supabase.from("saved_accounts").upsert(toUpdate, { onConflict: "id" });
        if (error) {
          throw new Error(`Gagal memperbarui data rekening lama: ${error.message}`);
        }
      }

      await refresh();
      toast.success(`${dedupPayload.length} rekening berhasil diproses (${toInsert.length} baru, ${toUpdate.length} diperbarui)`);
      setImportOpen(false);
      setImportFile(null);
    } catch (error) {
      console.error("Failed to import rekening", error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Gagal import file'}`);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Master Data Rekening</h2>
          <p className="text-sm text-muted-foreground">Kelola data rekening bank untuk SPM</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Import Excel
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Rekening dari Excel</DialogTitle>
                <DialogDescription>
                  Unggah file .xlsx atau .csv untuk menambahkan data rekening bank.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
                  <p className="font-semibold mb-2">Format File:</p>
                  <p>Kolom yang diperlukan: Atas Nama, Bank Code (contoh: BCA, MANDIRI), No Rekening</p>
                  <Button variant="link" size="sm" className="p-0 h-auto text-blue-600" onClick={downloadRekeningTemplate}>
                    Download Template →
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Pilih File Excel</Label>
                  <Input 
                    type="file" 
                    accept=".xlsx,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button 
                  onClick={handleImport} 
                  disabled={!importFile || importLoading}
                  className="w-full"
                >
                  {importLoading ? "Proses..." : "Import"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />Tambah Rekening
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">No</TableHead>
                <TableHead>Atas Nama</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>No Rekening</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc, idx) => (
                <TableRow key={acc.id}>
                  <TableCell className="text-center font-mono">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{acc.atasNama}</TableCell>
                  <TableCell>{acc.bankCode} - {acc.bankName}</TableCell>
                  <TableCell className="font-mono">{acc.rekening}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(acc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Belum ada data rekening. Tambahkan rekening untuk digunakan di SPM.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Rekening' : 'Tambah Rekening Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atas Nama</Label>
              <Input value={form.atasNama} onChange={e => setForm({ ...form, atasNama: e.target.value })} placeholder="Nama pemilik rekening" />
            </div>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={form.bankCode} onValueChange={v => setForm({ ...form, bankCode: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih bank" /></SelectTrigger>
                <SelectContent>
                  {BANK_CODES.map(b => <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>No Rekening</Label>
              <Input value={form.rekening} onChange={e => setForm({ ...form, rekening: e.target.value })} placeholder="Nomor rekening" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>{editId ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterRekening;
