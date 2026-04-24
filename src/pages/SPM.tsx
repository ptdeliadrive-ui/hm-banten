import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Printer, Eye, Edit, Trash2 } from "lucide-react";
import { getSPMStatusLabel, normalizeSPMStatus, type SPMDocument, type SPMNumberType, SPM_NUMBER_TYPES, inferSPMNumberType } from "@/lib/spm-store";
import { formatCurrency } from "@/lib/store";
import { useFinance } from "@/lib/finance-context";
import SPMForm from "@/components/SPMForm";
import SPMPrintView from "@/components/SPMPrintView";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

const statusColor = (s: string) => {
  if (s === 'dibayar') return 'default';
  if (s === 'disetujui_ketua') return 'default';
  if (s === 'disetujui_bendahara') return 'secondary';
  return 'outline';
};

function formatApprovalDate(dateText?: string | null) {
  if (!dateText) return "-";
  const d = new Date(dateText);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID");
}

type View = 'list' | 'create' | 'edit' | 'preview';
type SPMChangeAction = "edit";

interface SPMDeleteRequest {
  id: number;
  spm_id: string;
  spm_number: string;
  reason: string;
  status: string;
  requested_by_user_id: string;
  requested_by_role: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_at: string;
}

const SPM = () => {
  const { spms, setSPMs, reloadSPMs } = useFinance();
  const { role, user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<SPMNumberType | "all">("all");
  const [view, setView] = useState<View>('list');
  const [selectedSPM, setSelectedSPM] = useState<SPMDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [editReasonOpen, setEditReasonOpen] = useState(false);
  const [deleteReasonOpen, setDeleteReasonOpen] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonTarget, setReasonTarget] = useState<SPMDocument | null>(null);
  const [pendingEditReason, setPendingEditReason] = useState("");
  const [reasonLoading, setReasonLoading] = useState(false);
  const [deleteRequests, setDeleteRequests] = useState<SPMDeleteRequest[]>([]);
  const [approveDeleteLoadingId, setApproveDeleteLoadingId] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const filtered = spms
    .filter(e => filter === "all" || normalizeSPMStatus(e.status) === filter)
    .filter(e => typeFilter === "all" || inferSPMNumberType(e.nomorSPM) === typeFilter);

  const canCreateSPM = role === "admin";
  const canReviewDeleteRequest = role === "bendahara";

  const pendingDeleteBySpmId = useMemo(() => {
    const map: Record<string, SPMDeleteRequest> = {};
    deleteRequests.forEach((req) => {
      if (req.status === "pending") {
        map[req.spm_id] = req;
      }
    });
    return map;
  }, [deleteRequests]);

  const loadDeleteRequests = async () => {
    if (!role || (role !== "admin" && role !== "bendahara")) {
      setDeleteRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from("spm_delete_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(`Gagal memuat pengajuan hapus SPM: ${error.message}`);
      return;
    }

    setDeleteRequests((data || []) as SPMDeleteRequest[]);
  };

  useEffect(() => {
    void loadDeleteRequests();
  }, [role]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedSPM ? `SPM-${selectedSPM.nomorSPM}` : 'SPM',
  });

  const logSPMChange = async (
    action: SPMChangeAction,
    reason: string,
    beforeData: SPMDocument,
    afterData?: SPMDocument,
  ) => {
    if (!user?.id || role !== "admin") {
      return { error: new Error("Hanya admin yang bisa mencatat perubahan SPM") };
    }

    return supabase.from("spm_change_logs").insert({
      spm_id: beforeData.id,
      spm_number: beforeData.nomorSPM,
      action,
      reason,
      actor_user_id: user.id,
      actor_role: role,
      before_data: beforeData,
      after_data: afterData || null,
    });
  };

  const handleSave = (spm: SPMDocument) => {
    const previous = spms.find((item) => item.id === spm.id);
    const editReason = pendingEditReason.trim();

    setSPMs(prev => {
      const exists = prev.find(s => s.id === spm.id);
      if (exists) return prev.map(s => s.id === spm.id ? spm : s);
      return [spm, ...prev];
    });

    if (previous && editReason) {
      void (async () => {
        const { error } = await logSPMChange("edit", editReason, previous, spm);
        if (error) {
          toast.error(`SPM tersimpan, tapi log alasan edit gagal: ${error.message}`);
          return;
        }

        toast.success("Perubahan SPM tersimpan dan alasan edit tercatat");
      })();
    }

    setPendingEditReason("");
    setView('list');
  };

  const updateStatus = async (spm: SPMDocument, status: SPMDocument['status']) => {
    if (status === "dibayar") {
      setSPMs(spms.map((item) => item.id === spm.id ? { ...item, status } : item));
      return;
    }

    setStatusLoadingId(spm.id);
    const { error } = await supabase.rpc("approve_spm", { p_spm_id: spm.id });

    if (error) {
      toast.error(`Gagal memproses persetujuan SPM: ${error.message}`);
      setStatusLoadingId(null);
      return;
    }

    await reloadSPMs();
    toast.success(
      status === "disetujui_bendahara"
        ? "SPM disetujui bendahara"
        : "SPM disetujui ketua",
    );
    setStatusLoadingId(null);
  };

  const openEditReasonDialog = (spm: SPMDocument) => {
    setReasonTarget(spm);
    setReasonDraft("");
    setEditReasonOpen(true);
  };

  const confirmEditReason = () => {
    const reason = reasonDraft.trim();
    if (reason.length < 5) {
      toast.error("Alasan edit minimal 5 karakter");
      return;
    }
    if (!reasonTarget) {
      toast.error("Data SPM tidak ditemukan");
      return;
    }

    setPendingEditReason(reason);
    setSelectedSPM(reasonTarget);
    setEditReasonOpen(false);
    setView("edit");
    setReasonDraft("");
    setReasonTarget(null);
  };

  const openDeleteReasonDialog = (spm: SPMDocument) => {
    setReasonTarget(spm);
    setReasonDraft("");
    setDeleteReasonOpen(true);
  };

  const submitDeleteRequest = async () => {
    const reason = reasonDraft.trim();
    if (reason.length < 5) {
      toast.error("Alasan penghapusan minimal 5 karakter");
      return;
    }
    if (!reasonTarget) {
      toast.error("Data SPM tidak ditemukan");
      return;
    }
    if (!user?.id || role !== "admin") {
      toast.error("Hanya admin yang bisa mengajukan penghapusan SPM");
      return;
    }

    setReasonLoading(true);

    const { error: requestError } = await supabase.from("spm_delete_requests").insert({
      spm_id: reasonTarget.id,
      spm_number: reasonTarget.nomorSPM,
      reason,
      requested_by_user_id: user.id,
      requested_by_role: role,
    });

    if (requestError) {
      toast.error(`Gagal mengajukan penghapusan SPM: ${requestError.message}`);
      setReasonLoading(false);
      return;
    }

    toast.success("Penghapusan SPM berhasil diajukan dan menunggu persetujuan bendahara");
    await loadDeleteRequests();

    setDeleteReasonOpen(false);
    setReasonDraft("");
    setReasonTarget(null);
    setReasonLoading(false);
  };

  const approveDeleteRequest = async (request: SPMDeleteRequest) => {
    setApproveDeleteLoadingId(request.id);
    const { error } = await supabase.rpc("approve_spm_delete_request", { p_request_id: request.id });

    if (error) {
      toast.error(`Gagal menyetujui penghapusan SPM: ${error.message}`);
      setApproveDeleteLoadingId(null);
      return;
    }

    await Promise.all([reloadSPMs(), loadDeleteRequests()]);
    toast.success("Penghapusan SPM telah disetujui bendahara dan data dihapus");
    setApproveDeleteLoadingId(null);
  };

  if (view === 'create') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Buat SPM Baru</h2>
        <SPMForm existingSPMs={spms} onSave={handleSave} onCancel={() => setView('list')} />
      </div>
    );
  }

  if (view === 'edit' && selectedSPM) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Edit SPM</h2>
        <SPMForm
          existingSPMs={spms}
          editSPM={selectedSPM}
          onSave={handleSave}
          onCancel={() => {
            setPendingEditReason("");
            setView('list');
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Surat Perintah Membayar</h2>
          <p className="text-sm text-muted-foreground">Kelola SPM organisasi</p>
        </div>
        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as SPMNumberType | "all")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              {SPM_NUMBER_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="disetujui_bendahara">Disetujui Bendahara</SelectItem>
              <SelectItem value="disetujui_ketua">Disetujui Ketua</SelectItem>
              <SelectItem value="dibayar">Dibayar</SelectItem>
            </SelectContent>
          </Select>
          {canCreateSPM && (
            <Button onClick={() => setView('create')}>
              <Plus className="mr-2 h-4 w-4" />Buat SPM
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No SPM</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Persetujuan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((spm) => (
                  <TableRow key={spm.id}>
                    <TableCell className="font-mono text-xs font-semibold">{spm.nomorSPM}</TableCell>
                    <TableCell>{spm.tanggal}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(spm.total)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(spm.status) as any}>
                        {getSPMStatusLabel(spm.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>Bendahara: {formatApprovalDate(spm.approvedBendaharaAt)}</div>
                      <div>Ketua: {formatApprovalDate(spm.approvedKetuaAt)}</div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const pendingDeleteReq = pendingDeleteBySpmId[spm.id];

                        return (
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedSPM(spm); setPreviewOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {role === "admin" && spm.status === 'draft' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditReasonDialog(spm)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {role === "admin" && !pendingDeleteReq && (
                          <Button variant="outline" size="sm" onClick={() => openDeleteReasonDialog(spm)}>
                            <Trash2 className="mr-1 h-4 w-4" /> Ajukan Hapus
                          </Button>
                        )}
                        {role === "admin" && pendingDeleteReq && (
                          <Badge variant="secondary" className="text-[10px]">Menunggu persetujuan bendahara</Badge>
                        )}
                        {canReviewDeleteRequest && pendingDeleteReq && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void approveDeleteRequest(pendingDeleteReq)}
                            disabled={approveDeleteLoadingId === pendingDeleteReq.id}
                            title={`Alasan admin: ${pendingDeleteReq.reason}`}
                          >
                            {approveDeleteLoadingId === pendingDeleteReq.id ? "Memproses..." : "Setujui Hapus"}
                          </Button>
                        )}
                        {role === "bendahara" && spm.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void updateStatus(spm, 'disetujui_bendahara')}
                            disabled={statusLoadingId === spm.id}
                          >
                            Setujui Bendahara
                          </Button>
                        )}
                        {role === "ketua" && spm.status === 'disetujui_bendahara' && (
                          <Button
                            size="sm"
                            onClick={() => void updateStatus(spm, 'disetujui_ketua')}
                            disabled={statusLoadingId === spm.id}
                          >
                            Setujui Ketua
                          </Button>
                        )}
                        {role === "admin" && spm.status === 'disetujui_ketua' && (
                          <Button size="sm" onClick={() => void updateStatus(spm, 'dibayar')}>
                            Bayar
                          </Button>
                        )}
                      </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Belum ada SPM
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogDescription className="sr-only">
            Preview dokumen SPM lengkap beserta opsi cetak atau simpan PDF.
          </DialogDescription>
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between">
            <h3 className="font-semibold">Preview SPM</h3>
            <Button size="sm" onClick={() => handlePrint()}>
              <Printer className="mr-2 h-4 w-4" />Cetak / PDF
            </Button>
          </div>
          {selectedSPM && <SPMPrintView ref={printRef} spm={selectedSPM} />}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editReasonOpen}
        onOpenChange={(open) => {
          setEditReasonOpen(open);
          if (!open) {
            setReasonDraft("");
            setReasonTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alasan Edit SPM</DialogTitle>
            <DialogDescription>
              Tuliskan alasan perubahan data SPM. Alasan ini akan disimpan sebagai jejak audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="Contoh: Perbaikan nominal karena ada salah input"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditReasonOpen(false)}>Batal</Button>
              <Button onClick={confirmEditReason}>Lanjut Edit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteReasonOpen}
        onOpenChange={(open) => {
          if (reasonLoading) return;
          setDeleteReasonOpen(open);
          if (!open) {
            setReasonDraft("");
            setReasonTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajukan Hapus SPM</DialogTitle>
            <DialogDescription>
              Penghapusan SPM harus diajukan admin terlebih dulu dan wajib disetujui bendahara.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="Contoh: Dokumen duplikat hasil uji coba"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteReasonOpen(false)} disabled={reasonLoading}>Batal</Button>
              <Button variant="destructive" onClick={() => void submitDeleteRequest()} disabled={reasonLoading}>
                {reasonLoading ? "Menyimpan..." : "Ajukan Penghapusan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SPM;
