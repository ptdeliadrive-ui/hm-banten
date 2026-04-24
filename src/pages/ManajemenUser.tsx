import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { invokeManageUsers } from "@/lib/manage-users-api";
import { toast } from "sonner";
import { RefreshCw, UserPlus } from "lucide-react";

type AppRole = "admin" | "bendahara" | "ketua";

interface ManagedUser {
  id: string;
  email: string;
  role: AppRole | null;
  createdAt?: string;
  lastSignInAt?: string | null;
  bannedUntil?: string | null;
}

function formatDate(dateText?: string | null) {
  if (!dateText) return "-";
  const d = new Date(dateText);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID");
}

export default function ManajemenUser() {
  const { user: currentUser, session } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [hasMore, setHasMore] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetPasswordDraft, setResetPasswordDraft] = useState("");
  const [actionByUser, setActionByUser] = useState<Record<string, boolean>>({});

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("bendahara");

  const [roleDraft, setRoleDraft] = useState<Record<string, AppRole>>({});

  const now = Date.now();
  const isCurrentUser = (u: ManagedUser) => currentUser?.id === u.id;
  const isDisabled = (u: ManagedUser) => {
    if (!u.bannedUntil) return false;
    const t = new Date(u.bannedUntil).getTime();
    return !isNaN(t) && t > now;
  };

  const loadUsers = async () => {
    if (!session) return;

    setLoading(true);
    const { data, error } = await invokeManageUsers<{ users?: ManagedUser[]; hasMore?: boolean }>({ action: "listUsers", page, perPage });

    if (error) {
      toast.error(`Gagal memuat user: ${error.message}`);
      setLoading(false);
      return;
    }

    const loadedUsers = ((data?.users || []) as ManagedUser[]).filter((u) => !!u.email);
    setUsers(loadedUsers);
    setHasMore(Boolean(data?.hasMore));

    const drafts: Record<string, AppRole> = {};
    loadedUsers.forEach((u) => {
      drafts[u.id] = u.role === "admin" || u.role === "ketua" ? u.role : "bendahara";
    });
    setRoleDraft(drafts);
    setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
  }, [page, session]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || !newPassword) {
      toast.error("Email dan password wajib diisi");
      return;
    }

    const { error } = await invokeManageUsers({
      action: "createUser",
      email: newEmail,
      password: newPassword,
      role: newRole,
    });

    if (error) {
      toast.error(`Gagal membuat user: ${error.message}`);
      return;
    }

    toast.success("User berhasil dibuat");
    setNewEmail("");
    setNewPassword("");
    setNewRole("bendahara");
    setOpenCreate(false);
    setPage(1);
    await loadUsers();
  };

  const handleSaveRole = async (user: ManagedUser) => {
    const targetRole = roleDraft[user.id];
    if (!targetRole) return;

    const { error } = await invokeManageUsers({
      action: "setRole",
      userId: user.id,
      role: targetRole,
    });

    if (error) {
      toast.error(`Gagal ubah role ${user.email}: ${error.message}`);
      return;
    }

    toast.success(`Role ${user.email} diubah ke ${targetRole}`);
    await loadUsers();
  };

  const withActionLoading = async (userId: string, action: () => Promise<void>) => {
    setActionByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      await action();
    } finally {
      setActionByUser((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleDisabled = async (user: ManagedUser) => {
    await withActionLoading(user.id, async () => {
      const { error } = await invokeManageUsers({
        action: "setDisabled",
        userId: user.id,
        disabled: !isDisabled(user),
      });

      if (error) {
        toast.error(`Gagal ubah status ${user.email}: ${error.message}`);
        return;
      }

      toast.success(!isDisabled(user) ? `User ${user.email} dinonaktifkan` : `User ${user.email} diaktifkan`);
      await loadUsers();
    });
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    const ok = window.confirm(`Hapus user ${user.email}? Aksi ini tidak bisa dibatalkan.`);
    if (!ok) return;

    await withActionLoading(user.id, async () => {
      const { error } = await invokeManageUsers({
        action: "deleteUser",
        userId: user.id,
      });

      if (error) {
        toast.error(`Gagal hapus ${user.email}: ${error.message}`);
        return;
      }

      toast.success(`User ${user.email} dihapus`);
      await loadUsers();
    });
  };

  const openResetDialog = (user: ManagedUser) => {
    setResetTarget(user);
    setResetPasswordDraft("");
    setOpenReset(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;

    if (resetPasswordDraft.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }

    await withActionLoading(resetTarget.id, async () => {
      const { error } = await invokeManageUsers({
        action: "resetPassword",
        userId: resetTarget.id,
        newPassword: resetPasswordDraft,
      });

      if (error) {
        toast.error(`Gagal reset password ${resetTarget.email}: ${error.message}`);
        return;
      }

      toast.success(`Password ${resetTarget.email} berhasil direset`);
      setOpenReset(false);
      setResetTarget(null);
      setResetPasswordDraft("");
    });
  };

  const filteredUsers = users.filter((u) => u.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Manajemen User</h2>
          <p className="text-sm text-muted-foreground">Khusus admin: tambah akun dan atur role</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>

          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> Tambah User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah User Baru</DialogTitle>
                <DialogDescription>
                  Buat akun baru dan tentukan role awal untuk pengguna tersebut.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="bendahara">bendahara</SelectItem>
                      <SelectItem value="ketua">ketua</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full">Simpan User</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-sm w-full">
              <Input
                placeholder="Cari email user..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
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
              <span className="text-sm text-muted-foreground min-w-[70px] text-center">Hal {page}</span>
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role Saat Ini</TableHead>
                <TableHead>Role Baru</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead>Login Terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{u.email}</span>
                      {isCurrentUser(u) && <Badge variant="outline">Akun Anda</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role || "tanpa role"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={roleDraft[u.id] || "bendahara"} onValueChange={(v) => setRoleDraft((prev) => ({ ...prev, [u.id]: v as AppRole }))}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="bendahara">bendahara</SelectItem>
                        <SelectItem value="ketua">ketua</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isDisabled(u) ? "destructive" : "default"}>
                      {isDisabled(u) ? "Nonaktif" : "Aktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>{formatDate(u.lastSignInAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSaveRole(u)}
                        disabled={actionByUser[u.id] || isCurrentUser(u)}
                        title={isCurrentUser(u) ? "Tidak bisa mengubah role akun sendiri" : undefined}
                      >
                        Simpan Role
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openResetDialog(u)}
                        disabled={actionByUser[u.id] || isCurrentUser(u)}
                        title={isCurrentUser(u) ? "Tidak bisa reset password akun sendiri dari sini" : undefined}
                      >
                        Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleToggleDisabled(u)}
                        disabled={actionByUser[u.id] || isCurrentUser(u)}
                        title={isCurrentUser(u) ? "Tidak bisa menonaktifkan akun sendiri" : undefined}
                      >
                        {isDisabled(u) ? "Aktifkan" : "Nonaktifkan"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDeleteUser(u)}
                        disabled={actionByUser[u.id] || isCurrentUser(u)}
                        title={isCurrentUser(u) ? "Tidak bisa menghapus akun sendiri" : undefined}
                      >
                        Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Belum ada data user
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password User</DialogTitle>
            <DialogDescription>
              Masukkan password baru untuk {resetTarget?.email || "user yang dipilih"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="text-sm text-muted-foreground">User: {resetTarget?.email || "-"}</div>
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input
                type="password"
                value={resetPasswordDraft}
                onChange={(e) => setResetPasswordDraft(e.target.value)}
                placeholder="Minimal 8 karakter"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!resetTarget || !!(resetTarget && actionByUser[resetTarget.id])}>
              Simpan Password Baru
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
