import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { FinanceProvider } from "@/lib/finance-context";
import { IncomeProvider } from "@/lib/income-context";
import { MemberProvider } from "@/lib/member-context";
import { AuthProvider, type AppRole, useAuth } from "@/lib/auth-context";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pemasukan = lazy(() => import("./pages/Pemasukan"));
const Pengeluaran = lazy(() => import("./pages/Pengeluaran"));
const SPM = lazy(() => import("./pages/SPM"));
const MasterRekening = lazy(() => import("./pages/MasterRekening"));
const Anggota = lazy(() => import("./pages/Anggota"));
const ManajemenUser = lazy(() => import("./pages/ManajemenUser"));
const AuditAdmin = lazy(() => import("./pages/AuditAdmin"));
const Laporan = lazy(() => import("./pages/Laporan"));
const RekapIuran = lazy(() => import("./pages/RekapIuran"));
const RekapIuranSeluruhAnggota = lazy(() => import("./pages/RekapIuranSeluruhAnggota"));
const RekonsiliasiBank = lazy(() => import("./pages/RekonsiliasiBank"));
const BackupRestore = lazy(() => import("./pages/BackupRestore"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function LoadingPage() {
  return <div className="p-6 text-sm text-muted-foreground">Memuat halaman...</div>;
}

function UnauthorizedPage() {
  const { role } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="rounded-lg border bg-card p-6 text-center max-w-md">
        <h2 className="text-lg font-semibold">Akses Ditolak</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Akun Anda ({role || "tanpa role"}) tidak memiliki akses ke halaman ini.
        </p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  if (loading) return <LoadingPage />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

function HomePage() {
  return <Dashboard />;
}

function AdminBendaharaRoutes() {
  return (
    <MemberProvider>
      <IncomeProvider>
        <FinanceProvider>
          <AppLayout>
            <Suspense fallback={<LoadingPage />}>
              <Routes>
                <Route path="/" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><HomePage /></RequireRole>} />
                <Route path="/laporan" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><Laporan /></RequireRole>} />
                <Route path="/rekap-iuran" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><RekapIuran /></RequireRole>} />
                <Route path="/rekap-iuran-seluruh-anggota" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><RekapIuranSeluruhAnggota /></RequireRole>} />
                <Route path="/rekonsiliasi-bank" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><RekonsiliasiBank /></RequireRole>} />

                <Route path="/pemasukan" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><Pemasukan /></RequireRole>} />
                <Route path="/pengeluaran" element={<RequireRole roles={["admin"]}><Pengeluaran /></RequireRole>} />
                <Route path="/spm" element={<RequireRole roles={["admin", "bendahara", "ketua"]}><SPM /></RequireRole>} />
                <Route path="/master-rekening" element={<RequireRole roles={["admin"]}><MasterRekening /></RequireRole>} />
                <Route path="/anggota" element={<RequireRole roles={["admin"]}><Anggota /></RequireRole>} />
                <Route path="/manajemen-user" element={<RequireRole roles={["admin"]}><ManajemenUser /></RequireRole>} />
                <Route path="/audit-admin" element={<RequireRole roles={["admin"]}><AuditAdmin /></RequireRole>} />
                <Route path="/backup-restore" element={<RequireRole roles={["admin"]}><BackupRestore /></RequireRole>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </FinanceProvider>
      </IncomeProvider>
    </MemberProvider>
  );
}

function ProtectedAppRoutes() {
  return <AdminBendaharaRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<LoadingPage />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<RequireAuth><UnauthorizedPage /></RequireAuth>} />
              <Route path="/*" element={<RequireAuth><ProtectedAppRoutes /></RequireAuth>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
