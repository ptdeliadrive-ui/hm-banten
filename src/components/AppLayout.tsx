import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";

function GantiPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password minimal 8 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      toast.error(`Gagal mengubah password: ${error.message}`);
      return;
    }

    toast.success("Password berhasil diubah. Silakan login ulang.");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ganti Password</DialogTitle>
          <DialogDescription>
            Masukkan password baru Anda. Minimal 8 karakter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Password Baru</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Konfirmasi Password Baru</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, signOut, user } = useAuth();
  const [gantiPasswordOpen, setGantiPasswordOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Berhasil logout");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-sm font-semibold text-foreground">Sistem Manajemen Keuangan Organisasi</h1>
            <div className="ml-auto flex items-center gap-2">
              {role && <Badge variant="outline" className="uppercase">{role}</Badge>}
              {user?.email && <span className="hidden text-xs text-muted-foreground md:inline">{user.email}</span>}
              <Button variant="outline" size="sm" onClick={() => setGantiPasswordOpen(true)}>
                <KeyRound className="mr-1 h-4 w-4" /> Ganti Password
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-1 h-4 w-4" /> Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <GantiPasswordDialog open={gantiPasswordOpen} onClose={() => setGantiPasswordOpen(false)} />
    </SidebarProvider>
  );
}
