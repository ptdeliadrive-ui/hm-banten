import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, Upload, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type BackupData = {
  version: number;
  exportedAt: string;
  tables: {
    members: unknown[];
    incomes: unknown[];
    manual_expenses: unknown[];
    spm_categories: unknown[];
    rekap_iuran_tabung_values: unknown[];
  };
};

type RestorePreview = {
  members: number;
  incomes: number;
  manual_expenses: number;
  spm_categories: number;
  rekap_iuran_tabung_values: number;
};

async function fetchAll(table: string) {
  const { data, error } = await supabase.from(table as "members").select("*");
  if (error) throw new Error(`Gagal mengambil ${table}: ${error.message}`);
  return data ?? [];
}

export default function BackupRestore() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [pendingData, setPendingData] = useState<BackupData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const [members, incomes, manual_expenses, spm_categories, rekap_iuran_tabung_values] = await Promise.all([
        fetchAll("members"),
        fetchAll("incomes"),
        fetchAll("manual_expenses"),
        fetchAll("spm_categories"),
        fetchAll("rekap_iuran_tabung_values"),
      ]);

      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tables: { members, incomes, manual_expenses, spm_categories, rekap_iuran_tabung_values },
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `backup-hiswana-banten-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal export backup.");
    } finally {
      setExporting(false);
    }
  };

  // ── Import: file select ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupData;
        if (!parsed.version || !parsed.tables) throw new Error("Format file tidak valid.");
        setPendingData(parsed);
        setPreview({
          members: parsed.tables.members?.length ?? 0,
          incomes: parsed.tables.incomes?.length ?? 0,
          manual_expenses: parsed.tables.manual_expenses?.length ?? 0,
          spm_categories: parsed.tables.spm_categories?.length ?? 0,
          rekap_iuran_tabung_values: parsed.tables.rekap_iuran_tabung_values?.length ?? 0,
        });
      } catch {
        toast.error("File backup tidak valid atau rusak.");
        setPendingData(null);
        setPreview(null);
      }
    };
    reader.readAsText(file);
    // Reset input agar bisa upload file yang sama lagi
    e.target.value = "";
  };

  // ── Restore: upsert all tables ──────────────────────────────────────────
  const handleRestore = async () => {
    if (!pendingData) return;
    setImporting(true);
    try {
      const { tables } = pendingData;
      const ops: Promise<void>[] = [];

      const upsertTable = async (table: string, rows: unknown[]) => {
        if (!rows || rows.length === 0) return;
        const CHUNK = 200;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabase.from(table as "members").upsert(chunk as never[], { onConflict: "id" });
          if (error) throw new Error(`Gagal restore ${table}: ${error.message}`);
        }
      };

      // spm_categories tidak punya id yang sama — pakai name sebagai key
      const upsertCategories = async () => {
        if (!tables.spm_categories || tables.spm_categories.length === 0) return;
        const { error } = await supabase.from("spm_categories").upsert(tables.spm_categories as never[], { onConflict: "name" });
        if (error) throw new Error(`Gagal restore spm_categories: ${error.message}`);
      };

      ops.push(
        upsertTable("members", tables.members),
        upsertTable("incomes", tables.incomes),
        upsertTable("manual_expenses", tables.manual_expenses),
        upsertCategories(),
        upsertTable("rekap_iuran_tabung_values", tables.rekap_iuran_tabung_values),
      );
      await Promise.all(ops);

      toast.success("Restore berhasil! Data telah dipulihkan.");
      setPendingData(null);
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal restore data.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Backup & Restore</h2>
        <p className="text-sm text-muted-foreground">Cadangkan atau pulihkan seluruh data keuangan organisasi.</p>
      </div>

      {/* ── Export ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Backup (Export)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Unduh seluruh data (anggota, pemasukan, pengeluaran, kategori, tabung) sebagai file JSON yang dapat disimpan sebagai cadangan.
          </p>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">Data yang dibackup:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Data Anggota</li>
              <li>Riwayat Pemasukan (iuran)</li>
              <li>Riwayat Pengeluaran (manual)</li>
              <li>Kategori SPM</li>
              <li>Data Tabung Rekap Iuran</li>
            </ul>
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? "Mengambil data..." : "Download Backup"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Import ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Restore (Import)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Unggah file backup JSON untuk memulihkan data. Data yang sudah ada akan diperbarui (upsert), tidak dihapus.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Perhatian</p>
            <p className="mt-1">Operasi restore akan menimpa data yang ada dengan data dari file backup. Pastikan file backup adalah file yang benar sebelum melanjutkan.</p>
          </div>

          <div>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Pilih File Backup (.json)
            </Button>
          </div>

          {/* Preview */}
          {preview && pendingData && (
            <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" /> File valid — siap direstore
              </p>
              <p className="text-xs text-green-700">
                Dibuat: {new Date(pendingData.exportedAt).toLocaleString("id-ID")}
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(Object.entries(preview) as [string, number][]).map(([key, count]) => (
                  <div key={key} className="flex justify-between bg-white rounded px-2 py-1 border border-green-200">
                    <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                    <span className="font-semibold">{count} baris</span>
                  </div>
                ))}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full mt-2" disabled={importing}>
                    {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {importing ? "Memulihkan data..." : "Restore Sekarang"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Restore</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini akan menimpa data yang ada. Apakah Anda yakin ingin melanjutkan restore dari file backup tanggal{" "}
                      <strong>{new Date(pendingData.exportedAt).toLocaleDateString("id-ID")}</strong>?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestore}>Ya, Restore</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
