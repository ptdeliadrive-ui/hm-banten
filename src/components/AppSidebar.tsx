import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Users,
  BarChart3,
  CreditCard,
  Landmark,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { type AppRole, useAuth } from "@/lib/auth-context";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "bendahara"] as AppRole[] },
  { title: "Pemasukan", url: "/pemasukan", icon: ArrowDownCircle, roles: ["admin", "bendahara"] as AppRole[] },
  { title: "Pengeluaran", url: "/pengeluaran", icon: ArrowUpCircle, roles: ["admin"] as AppRole[] },
  { title: "SPM", url: "/spm", icon: FileText, roles: ["admin", "bendahara", "ketua"] as AppRole[] },
  { title: "Laporan", url: "/laporan", icon: BarChart3, roles: ["admin", "bendahara"] as AppRole[] },
  { title: "Rekap Iuran TF", url: "/rekap-iuran", icon: FileText, roles: ["admin", "bendahara"] as AppRole[] },
  { title: "Rekap Iuran Seluruh Anggota", url: "/rekap-iuran-seluruh-anggota", icon: FileText, roles: ["admin", "bendahara"] as AppRole[] },
  { title: "Rekonsiliasi Bank", url: "/rekonsiliasi-bank", icon: Landmark, roles: ["admin", "bendahara"] as AppRole[] },
  { title: "Master Rekening", url: "/master-rekening", icon: CreditCard, roles: ["admin"] as AppRole[] },
  { title: "Anggota", url: "/anggota", icon: Users, roles: ["admin"] as AppRole[] },
  { title: "Manajemen User", url: "/manajemen-user", icon: UserCog, roles: ["admin"] as AppRole[] },
  { title: "Audit Admin", url: "/audit-admin", icon: ShieldCheck, roles: ["admin"] as AppRole[] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();

  const visibleItems = menuItems.filter((item) => role && item.roles.includes(role));

  return (
    <Sidebar
      collapsible="icon"
      className="[&>[data-sidebar=sidebar]]:bg-gradient-to-b [&>[data-sidebar=sidebar]]:from-slate-950 [&>[data-sidebar=sidebar]]:via-blue-950 [&>[data-sidebar=sidebar]]:to-black [&>[data-sidebar=sidebar]]:shadow-xl"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <BarChart3 className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold text-sidebar-primary-foreground">DPC BANTEN HISWANA MIGAS</h2>
              <p className="text-xs text-sidebar-foreground/60">Manajemen Keuangan</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-blue-900/45"
                      activeClassName="bg-blue-700/45 text-white font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
