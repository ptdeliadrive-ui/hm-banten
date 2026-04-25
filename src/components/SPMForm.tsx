import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Settings2, Upload, Download } from "lucide-react";
import { type SPMDocument, type SPMLineItem, type SavedAccount, type SPMNumberType, BANK_CODES, SPM_NUMBER_TYPES, getSPMCategories, saveSPMCategories, generateSPMNumberNew, inferSPMNumberType } from "@/lib/spm-store";
import { downloadSPMItemsTemplate, parseSPMItemsExcel } from "@/lib/excel-parser";
import { formatCurrency } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MONTHS_ID = [
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

function getKeteranganTemplate(type: SPMNumberType, month: number, year: number): string {
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1;
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const bulan = MONTHS_ID[safeMonth - 1].toUpperCase();

  if (type === "TF") {
    return `OPERASIONAL TRANSPORT FEE BULAN ${bulan} ${safeYear}`;
  }

  if (type === "OPRASIONAL") {
    return `OPERASIONAL KANTOR BULAN ${bulan} ${safeYear}`;
  }

  return "";
}

interface Props {
  existingSPMs: SPMDocument[];
  editSPM?: SPMDocument;
  onSave: (spm: SPMDocument) => void;
  onCancel: () => void;
}

function emptyItem(defaultKategori = "Lain-lain"): SPMLineItem {
  return {
    id: String(Date.now() + Math.random()),
    uraian: '',
    kategori: defaultKategori,
    bankCode: '',
    bankName: '',
    rekening: '',
    atasNama: '',
    jumlah: 0,
  };
}

export default function SPMForm({ existingSPMs, editSPM, onSave, onCancel }: Props) {
  const [tanggal, setTanggal] = useState(editSPM?.tanggal || new Date().toISOString().slice(0, 10));
  const [tujuan, setTujuan] = useState(editSPM?.tujuan || 'Ketua Hiswana Migas DPC Banten');
  const [lokasi, setLokasi] = useState(editSPM?.lokasi || 'Serang');
  const [kategori, setKategori] = useState(editSPM?.kategori || 'Operasional Kantor');
  const [namaKetua, setNamaKetua] = useState(editSPM?.namaKetua || localStorage.getItem('spm_nama_ketua') || 'H. Ahmad Fauzi');
  const [namaBendahara, setNamaBendahara] = useState(editSPM?.namaBendahara || localStorage.getItem('spm_nama_bendahara') || 'Siti Nurhaliza');
  const [nomorType, setNomorType] = useState<SPMNumberType>(inferSPMNumberType(editSPM?.nomorSPM));
  const [isManualNumber, setIsManualNumber] = useState(false);
  const [manualNomorSPM, setManualNomorSPM] = useState("");
  const [items, setItems] = useState<SPMLineItem[]>(editSPM?.items || [emptyItem(editSPM?.kategori || 'Operasional Kantor')]);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [categories, setCategories] = useState<string[]>(() => getSPMCategories());
  const [manageOpen, setManageOpen] = useState(false);
  const [newKategori, setNewKategori] = useState('');
  const [importing, setImporting] = useState(false);
  const parsedTanggal = useMemo(() => {
    const d = new Date(editSPM?.tanggal || new Date().toISOString());
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
  }, [editSPM?.tanggal]);
  const [keteranganBulan, setKeteranganBulan] = useState<number>(editSPM?.keteranganBulan || (parsedTanggal.getMonth() + 1));
  const [keteranganTahun, setKeteranganTahun] = useState<number>(editSPM?.keteranganTahun || parsedTanggal.getFullYear());
  const nomorSPMOtomatis = useMemo(() => {
    if (editSPM) return editSPM.nomorSPM;
    return generateSPMNumberNew(existingSPMs, tanggal, nomorType);
  }, [editSPM, existingSPMs, tanggal, nomorType]);

  const isKeteranganWajib = nomorType === "TF" || nomorType === "OPRASIONAL";
  const generatedKeterangan = useMemo(
    () => getKeteranganTemplate(nomorType, keteranganBulan, keteranganTahun),
    [nomorType, keteranganBulan, keteranganTahun],
  );

  useEffect(() => {
    if (!editSPM && !isManualNumber) {
      setManualNomorSPM(nomorSPMOtomatis);
    }
  }, [editSPM, isManualNumber, nomorSPMOtomatis]);

  useEffect(() => {
    let active = true;

    const loadAccounts = async () => {
      const { data, error } = await supabase.from("saved_accounts").select("*").order("created_at", { ascending: false });
      if (!active || error) return;

      setSavedAccounts((data || []).map((row) => ({
        id: row.id,
        bankCode: row.bank_code,
        bankName: row.bank_name,
        rekening: row.rekening,
        atasNama: row.atas_nama,
      })));
    };

    void loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  const total = items.reduce((s, i) => s + (i.jumlah || 0), 0);

  const updateItem = (id: string, field: keyof SPMLineItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      if (field === 'bankCode') {
        const bank = BANK_CODES.find(b => b.code === value);
        return { ...item, bankCode: value as string, bankName: bank?.name || '' };
      }
      return { ...item, [field]: value };
    }));
  };

  const selectAccount = (itemId: string, accountId: string) => {
    const acc = savedAccounts.find(a => a.id === accountId);
    if (!acc) return;
    setItems(items.map(item => item.id !== itemId ? item : {
      ...item, bankCode: acc.bankCode, bankName: acc.bankName, rekening: acc.rekening, atasNama: acc.atasNama
    }));
  };

  const addRow = () => setItems([...items, emptyItem(kategori || 'Lain-lain')]);
  const removeRow = (id: string) => items.length > 1 && setItems(items.filter(i => i.id !== id));

  const resolveBank = (rawCode: string, rawName?: string) => {
    const normalizedCode = rawCode.trim();
    const normalizedName = (rawName || "").trim();

    const byCode = BANK_CODES.find((b) => b.code === normalizedCode);
    if (byCode) {
      return { bankCode: byCode.code, bankName: byCode.name };
    }

    if (normalizedName) {
      const byName = BANK_CODES.find((b) => b.name.toLowerCase() === normalizedName.toLowerCase());
      if (byName) {
        return { bankCode: byName.code, bankName: byName.name };
      }
    }

    return {
      bankCode: normalizedCode,
      bankName: normalizedName,
    };
  };

  const handleImportItems = async (file: File) => {
    setImporting(true);
    try {
      const parsed = await parseSPMItemsExcel(file);
      if (parsed.length === 0) {
        toast.error("File tidak berisi data rincian SPM.");
        return;
      }

      const nextItems: SPMLineItem[] = parsed.map((row) => {
        const bank = resolveBank(row.bankCode, row.bankName);
        return {
          id: String(Date.now() + Math.random()),
          uraian: row.uraian,
          kategori: row.kategori || kategori || "Lain-lain",
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          rekening: row.rekening,
          atasNama: row.atasNama,
          jumlah: row.jumlah,
        };
      });

      setItems((prev) => {
        const hasOnlyEmptyRow =
          prev.length === 1 &&
          !prev[0].uraian &&
          !prev[0].bankCode &&
          !prev[0].rekening &&
          !prev[0].atasNama &&
          !prev[0].jumlah;

        if (hasOnlyEmptyRow) {
          return nextItems;
        }

        return [...prev, ...nextItems];
      });

      toast.success(`Import rincian SPM berhasil: ${nextItems.length} baris ditambahkan.`);
    } catch (error) {
      toast.error(`Gagal import Excel: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = () => {
    const hasEmpty = items.some(i => !i.uraian || !i.kategori || !i.bankCode || !i.rekening || !i.atasNama || !i.jumlah);
    if (hasEmpty) { alert('Semua field pada rincian harus diisi'); return; }
    if (!tanggal || !tujuan || !lokasi || !namaKetua || !namaBendahara) { alert('Semua field wajib harus diisi'); return; }

    const nomorSPM = editSPM
      ? editSPM.nomorSPM
      : (isManualNumber ? manualNomorSPM.trim() : nomorSPMOtomatis);

    if (!nomorSPM) {
      alert('Nomor SPM wajib diisi');
      return;
    }

    if (isKeteranganWajib && (!keteranganBulan || !keteranganTahun || !generatedKeterangan)) {
      alert('Keterangan SPM wajib terisi untuk jenis TF atau OPRASIONAL');
      return;
    }

    const duplicate = existingSPMs.some((spm) => spm.id !== editSPM?.id && spm.nomorSPM.trim().toLowerCase() === nomorSPM.toLowerCase());
    if (duplicate) {
      alert('Nomor SPM sudah digunakan. Gunakan nomor lain.');
      return;
    }

    localStorage.setItem('spm_nama_ketua', namaKetua);
    localStorage.setItem('spm_nama_bendahara', namaBendahara);

    const spm: SPMDocument = {
      id: editSPM?.id || String(Date.now()),
      nomorSPM,
      tanggal,
      tujuan,
      lokasi,
      kategori,
      keteranganHeader: isKeteranganWajib ? generatedKeterangan : (editSPM?.keteranganHeader || ''),
      keteranganBulan: isKeteranganWajib ? keteranganBulan : undefined,
      keteranganTahun: isKeteranganWajib ? keteranganTahun : undefined,
      items,
      total,
      status: editSPM?.status || 'draft',
      namaKetua,
      namaBendahara,
      createdAt: editSPM?.createdAt || new Date().toISOString(),
    };
    onSave(spm);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editSPM ? 'Edit SPM' : 'Buat SPM Baru'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jenis Nomor SPM</Label>
              <Select value={nomorType} onValueChange={(v) => setNomorType(v as SPMNumberType)} disabled={!!editSPM}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis nomor" />
                </SelectTrigger>
                <SelectContent>
                  {SPM_NUMBER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isKeteranganWajib && (
              <div className="space-y-2 md:col-span-2">
                <Label>Keterangan Header SPM</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Select
                    value={String(keteranganBulan)}
                    onValueChange={(v) => setKeteranganBulan(Number(v) || 1)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih bulan" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_ID.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={2000}
                    max={2100}
                    value={keteranganTahun}
                    onChange={(e) => setKeteranganTahun(Number(e.target.value) || new Date().getFullYear())}
                    placeholder="Tahun"
                  />
                  <Input value={generatedKeterangan} readOnly className="font-semibold" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Keterangan ini akan tampil di bawah judul SURAT PERINTAH MEMBAYAR (SPM).
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>No SPM</Label>
              {!editSPM && (
                <div className="flex items-center gap-2 pb-1">
                  <Checkbox
                    id="manual-nomor-spm"
                    checked={isManualNumber}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setIsManualNumber(next);
                      if (!next) setManualNomorSPM(nomorSPMOtomatis);
                    }}
                  />
                  <Label htmlFor="manual-nomor-spm" className="text-xs text-muted-foreground cursor-pointer">
                    Isi nomor manual
                  </Label>
                </div>
              )}
              <Input
                value={editSPM ? editSPM.nomorSPM : (isManualNumber ? manualNomorSPM : nomorSPMOtomatis)}
                onChange={(e) => setManualNomorSPM(e.target.value)}
                readOnly={Boolean(editSPM) || !isManualNumber}
                className="font-mono"
              />
              {!editSPM && !isManualNumber && (
                <p className="text-[11px] text-muted-foreground">Nomor otomatis akan mengikuti nomor tertinggi yang sudah ada.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tanggal SPM</Label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <div className="flex gap-2">
                <Select value={kategori} onValueChange={setKategori}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setManageOpen(true)} title="Kelola kategori">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Lokasi</Label>
              <Input value={lokasi} onChange={e => setLokasi(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tujuan Surat</Label>
            <Input value={tujuan} onChange={e => setTujuan(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Ketua (Menyetujui)</Label>
              <Input value={namaKetua} onChange={e => setNamaKetua(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Nama Bendahara (Mengajukan)</Label>
              <Input value={namaBendahara} onChange={e => setNamaBendahara(e.target.value)} required />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rincian Pengeluaran</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void downloadSPMItemsTemplate()}>
                <Download className="mr-1 h-4 w-4" />Template Excel
              </Button>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleImportItems(file);
                    }
                    e.currentTarget.value = "";
                  }}
                />
                <Button variant="outline" size="sm" type="button" disabled={importing} asChild>
                  <span>
                    <Upload className="mr-1 h-4 w-4" />{importing ? "Mengimpor..." : "Upload Excel"}
                  </span>
                </Button>
              </label>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-1 h-4 w-4" />Tambah Baris
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">No</TableHead>
                  <TableHead>Uraian</TableHead>
                  <TableHead className="w-44">Kategori</TableHead>
                  <TableHead className="w-40">Penerima</TableHead>
                  <TableHead className="w-36">Bank Tujuan</TableHead>
                  <TableHead className="w-32">No Rekening</TableHead>
                  <TableHead className="w-32">Jumlah (Rp)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center font-mono">{idx + 1}</TableCell>
                    <TableCell>
                      <Input value={item.uraian} onChange={e => updateItem(item.id, 'uraian', e.target.value)} placeholder="Uraian pengeluaran" className="h-8 text-xs" />
                    </TableCell>
                    <TableCell>
                      <Select value={item.kategori} onValueChange={v => updateItem(item.id, 'kategori', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {savedAccounts.length > 0 ? (
                        <Select
                          value={savedAccounts.find(a => a.rekening === item.rekening && a.bankCode === item.bankCode)?.id || ''}
                          onValueChange={v => selectAccount(item.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih penerima" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedAccounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.atasNama} ({acc.bankName} - {acc.rekening})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tambah di Master Rekening</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={item.bankCode} onValueChange={v => updateItem(item.id, 'bankCode', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih bank" /></SelectTrigger>
                        <SelectContent>
                          {BANK_CODES.map(b => <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={item.rekening} onChange={e => updateItem(item.id, 'rekening', e.target.value)} placeholder="No rekening" className="h-8 text-xs" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={item.jumlah || ''} onChange={e => updateItem(item.id, 'jumlah', Number(e.target.value))} placeholder="0" className="h-8 text-xs text-right" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(item.id)} disabled={items.length <= 1}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end mt-4 text-lg font-bold">
            Total: {formatCurrency(total)}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSubmit}>
          <Save className="mr-2 h-4 w-4" />{editSPM ? 'Simpan Perubahan' : 'Buat SPM'}
        </Button>
      </div>

      {/* Dialog Kelola Kategori */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kelola Kategori</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newKategori}
                onChange={e => setNewKategori(e.target.value)}
                placeholder="Nama kategori baru"
                onKeyDown={e => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
              />
              <Button
                type="button"
                onClick={() => {
                  const trimmed = newKategori.trim();
                  if (!trimmed || categories.includes(trimmed)) return;
                  const next = [...categories, trimmed];
                  setCategories(next);
                  saveSPMCategories(next);
                  setKategori(trimmed);
                  setNewKategori('');
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {categories.map((k) => (
                <li key={k} className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
                  <span className="text-sm">{k}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      const next = categories.filter(c => c !== k);
                      setCategories(next);
                      saveSPMCategories(next);
                      if (kategori === k) setKategori(next[0] || '');
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
