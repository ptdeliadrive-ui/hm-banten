import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import { useMembers } from "@/lib/member-context";
import { parseAnggotaExcel, downloadAnggotaTemplate, type AnggotaRow } from "@/lib/excel-parser";
import { toast } from "sonner";

const Anggota = () => {
  const { members, setMembers } = useMembers();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [bidangUsaha, setBidangUsaha] = useState('');
  const [noSPBU, setNoSPBU] = useState('');

  const filtered = members.filter(m =>
    m.namaPT.toLowerCase().includes(search.toLowerCase()) ||
    m.wilayah.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (bidangUsaha.trim().toLowerCase() === 'spbu' && !noSPBU.trim()) {
      toast.error('No SPBU wajib diisi untuk anggota SPBU');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const newMember = {
      id: String(Date.now()),
      namaPT: fd.get('namaPT') as string,
      bidangUsaha: fd.get('bidangUsaha') as string,
      wilayah: fd.get('wilayah') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      status: fd.get('status') as 'active' | 'inactive',
      noSPBU: String(fd.get('noSPBU') || '').trim() || undefined,
    };
    setMembers([newMember, ...members]);
    setOpen(false);
    setBidangUsaha('');
    setNoSPBU('');
  };

  const toggleStatus = (id: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' } : m));
  };

  const deleteMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Pilih file Excel terlebih dahulu");
      return;
    }

    setImportLoading(true);
    try {
      const rows = await parseAnggotaExcel(importFile);
      const newMembers = rows.map(row => ({
        id: String(Date.now()) + Math.random(),
        namaPT: row.namaPT,
        bidangUsaha: row.bidangUsaha,
        wilayah: row.wilayah,
        phone: row.phone,
        email: row.email,
        status: row.status,
        noSPBU: row.noSPBU,
      }));
      setMembers([...newMembers, ...members]);
      toast.success(`${newMembers.length} anggota berhasil ditambahkan`);
      setImportOpen(false);
      setImportFile(null);
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Gagal import file'}`);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Anggota</h2>
          <p className="text-sm text-muted-foreground">Manajemen anggota organisasi</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Anggota dari Excel</DialogTitle>
                <DialogDescription>
                  Unggah file .xlsx atau .csv untuk menambahkan data anggota secara massal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
                  <p className="font-semibold mb-2">Format File:</p>
                  <p>Kolom yang diperlukan: Nama PT, Bidang Usaha, Wilayah, Telepon, Email, Status. Jika Bidang Usaha = SPBU, kolom No SPBU wajib diisi.</p>
                  <Button variant="link" size="sm" className="p-0 h-auto text-blue-600" onClick={downloadAnggotaTemplate}>
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Tambah Anggota</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah Anggota Baru</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama PT</Label>
                <Input name="namaPT" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bidang Usaha</Label>
                  <Input
                    name="bidangUsaha"
                    required
                    value={bidangUsaha}
                    onChange={e => setBidangUsaha(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wilayah</Label>
                  <Input name="wilayah" required />
                </div>
              </div>
              {bidangUsaha.trim().toLowerCase() === 'spbu' && (
                <div className="space-y-2">
                  <Label>No SPBU</Label>
                  <Input
                    name="noSPBU"
                    required
                    value={noSPBU}
                    onChange={e => setNoSPBU(e.target.value)}
                    placeholder="Nomor SPBU"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telepon</Label>
                  <Input name="phone" required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select name="status" defaultValue="active">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Simpan</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama PT atau wilayah..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama PT</TableHead>
                <TableHead>Bidang Usaha</TableHead>
                <TableHead>Wilayah</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>No SPBU</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.namaPT}</TableCell>
                  <TableCell>{m.bidangUsaha}</TableCell>
                  <TableCell>{m.wilayah}</TableCell>
                  <TableCell>{m.phone}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleStatus(m.id)}>
                      {m.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.noSPBU || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMember(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Anggota;
