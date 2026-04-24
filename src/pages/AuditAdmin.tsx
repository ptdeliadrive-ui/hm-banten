import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { invokeManageUsers } from "@/lib/manage-users-api";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";

interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

function formatDate(dateText?: string) {
  if (!dateText) return "-";
  const d = new Date(dateText);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID");
}

export default function AuditAdmin() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const loadLogs = async (nextPage = page) => {
    if (!session) return;

    setLoading(true);
    const { data, error } = await invokeManageUsers<{ logs?: AuditLog[]; hasMore?: boolean; total?: number }>({
      action: "listAuditLogs",
      page: nextPage,
      perPage,
      query,
      actorQuery,
      targetQuery,
      dateFrom,
      dateTo,
    });

    if (error) {
      toast.error(`Gagal memuat audit log: ${error.message}`);
      setLoading(false);
      return;
    }

    setLogs((data?.logs || []) as AuditLog[]);
    setHasMore(Boolean(data?.hasMore));
    setTotal(Number(data?.total || 0));
    setLoading(false);
  };

  useEffect(() => {
    void loadLogs();
  }, [page, session]);

  const applySearch = async () => {
    setPage(1);
    await loadLogs(1);
  };

  const exportToExcel = async () => {
    if (logs.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Audit Admin");

      worksheet.columns = [
        { header: "Waktu", key: "createdAt", width: 24 },
        { header: "Aksi", key: "action", width: 18 },
        { header: "Actor", key: "actor", width: 36 },
        { header: "Target", key: "target", width: 36 },
        { header: "Detail", key: "detail", width: 60 },
      ];

      logs.forEach((log) => {
        worksheet.addRow({
          createdAt: formatDate(log.created_at),
          action: log.action,
          actor: log.actor_email || log.actor_user_id,
          target: log.target_email || log.target_user_id || "-",
          detail: JSON.stringify(log.detail || {}),
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `audit-admin-${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Audit log berhasil diexport ke Excel");
    } catch (error) {
      toast.error(`Gagal export Excel: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Riwayat Audit Admin</h2>
          <p className="text-sm text-muted-foreground">Riwayat aksi sensitif oleh admin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadLogs()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => void exportToExcel()}>
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Cari aksi (createUser, setRole, ...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Input
                placeholder="Cari email actor"
                value={actorQuery}
                onChange={(e) => setActorQuery(e.target.value)}
              />
              <Input
                placeholder="Cari email target"
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void applySearch()}>Cari</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setActorQuery("");
                    setTargetQuery("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                    void loadLogs(1);
                  }}
                >
                  Reset Filter
                </Button>
              </div>
              <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                Sebelumnya
              </Button>
              <span className="text-sm text-muted-foreground min-w-[110px] text-center">Hal {page} / Total {total}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || !hasMore}
              >
                Berikutnya
              </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDate(log.created_at)}</TableCell>
                  <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{log.actor_email || "-"}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{log.actor_user_id}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{log.target_email || "-"}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{log.target_user_id || "-"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[380px] truncate" title={JSON.stringify(log.detail || {})}>
                    {JSON.stringify(log.detail || {})}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada audit log</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
