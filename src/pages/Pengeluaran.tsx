import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { formatCurrency, generateSPMNumber, type Expense } from "@/lib/store";
import { useFinance } from "@/lib/finance-context";
import { toast } from "sonner";

const EXPENSE_TYPES = ['Operasional', 'Konsumsi', 'Perlengkapan', 'Transport', 'Lainnya'];

const statusColor = (s: string) => {
  if (s === 'dibayar') return 'default';
  if (s === 'disetujui') return 'secondary';
  return 'outline';
};

const Pengeluaran = () => {
  const { allExpenses, manualExpenses, setManualExpenses } = useFinance();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({});

  const filtered = allExpenses.filter(e =>
    e.recipient.toLowerCase().includes(search.toLowerCase()) ||
    e.spmNumber.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setEditId(null);
    setFormData({});
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (!manualExpenses.find(e => e.id === expense.id)) {
      toast.error("Hanya pengeluaran manual yang bisa diedit");
      return;
    }
    setEditId(expense.id);
    setFormData(expense);
    setOpen(true);
  };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newExpense: Expense = {
      id: editId || String(Date.now()),
      spmNumber: editId ? (formData.spmNumber || generateSPMNumber()) : generateSPMNumber(),
      date: fd.get('date') as string,
      type: fd.get('type') as string,
      amount: Number(fd.get('amount')),
      recipient: fd.get('recipient') as string,
      accountNumber: fd.get('accountNumber') as string,
      bank: fd.get('bank') as string,
      bankCode: fd.get('bankCode') as string,
      notes: fd.get('notes') as string,
      spmStatus: editId ? (formData.spmStatus || 'draft') : 'draft',
    };

    if (editId) {
      setManualExpenses(manualExpenses.map(e => e.id === editId ? newExpense : e));
      toast.success("Pengeluaran berhasil diperbarui");
    } else {
      setManualExpenses([newExpense, ...manualExpenses]);
      toast.success("Pengeluaran berhasil ditambahkan");
    }
    setOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!manualExpenses.find(e => e.id === id)) {
      toast.error("Hanya pengeluaran manual yang bisa dihapus");
      return;
    }
    setManualExpenses(manualExpenses.filter(e => e.id !== id));
    toast.success("Pengeluaran berhasil dihapus");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pengeluaran</h2>
          <p className="text-sm text-muted-foreground">Pencatatan pengeluaran organisasi (termasuk dari SPM)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Tambah Pengeluaran</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran Baru'}</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input name="date" type="date" defaultValue={formData.date || ''} required />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Pengeluaran</Label>
                  <Select name="type" defaultValue={formData.type || ''} required>
                    <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input name="amount" type="number" defaultValue={formData.amount || ''} required />
                </div>
                <div className="space-y-2">
                  <Label>Penerima</Label>
                  <Input name="recipient" defaultValue={formData.recipient || ''} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>No Rekening</Label>
                  <Input name="accountNumber" defaultValue={formData.accountNumber || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Bank</Label>
                  <Input name="bank" defaultValue={formData.bank || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Kode Bank</Label>
                  <Input name="bankCode" defaultValue={formData.bankCode || ''} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input name="notes" placeholder="Opsional" defaultValue={formData.notes || ''} />
              </div>
              <Button type="submit" className="w-full">{editId ? 'Simpan Perubahan' : 'Simpan'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari penerima, SPM, atau jenis..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No SPM</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="font-mono text-xs">{exp.spmNumber}</TableCell>
                    <TableCell>{exp.date}</TableCell>
                    <TableCell>
                      <Badge variant={exp.type === 'SPM' ? 'secondary' : 'outline'}>
                        {exp.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(exp.amount)}</TableCell>
                    <TableCell>{exp.recipient}</TableCell>
                    <TableCell>{exp.bank}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{exp.notes}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(exp.spmStatus) as any}>
                        {exp.spmStatus.charAt(0).toUpperCase() + exp.spmStatus.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {manualExpenses.find(e => e.id === exp.id) && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(exp)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(exp.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Pengeluaran;
