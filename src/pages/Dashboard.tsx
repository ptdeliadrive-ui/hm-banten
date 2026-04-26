import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";
import { formatCurrency } from "@/lib/store";
import { useIncomes } from "@/lib/income-context";
import { useFinance } from "@/lib/finance-context";
import { useMembers } from "@/lib/member-context";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const PIE_COLORS = ["#003087", "#1F5EBF", "#4A90D9", "#7EB7E8", "#B8D9F5", "#F4A261", "#E76F51", "#2A9D8F"];

function getMonthIndexFromIncome(monthLabel?: string) {
  if (!monthLabel) return -1;
  const normalized = monthLabel.trim().toLowerCase();
  return MONTHS.findIndex((m) => m.toLowerCase() === normalized);
}

function formatShortCurrency(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">-</span>;
  if (previous === 0) return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp className="h-3 w-3" />Baru</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp className="h-3 w-3" />+{pct}%</span>;
  if (pct < 0) return <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="h-3 w-3" />{pct}%</span>;
  return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
}

const Dashboard = () => {
  const { incomes } = useIncomes();
  const { allExpenses } = useFinance();
  const { members } = useMembers();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // ── KPI totals ─────────────────────────────────────────────────────────
  const paidIncomes = incomes.filter((i) => i.status === "lunas");

  function incomeForMonth(monthIdx: number, year: number) {
    return paidIncomes.filter((inc) => {
      if (inc.date) {
        const d = new Date(inc.date);
        if (!Number.isNaN(d.getTime())) return d.getFullYear() === year && d.getMonth() === monthIdx;
      }
      const fallback = getMonthIndexFromIncome(inc.month);
      return inc.year === year && fallback === monthIdx;
    }).reduce((s, i) => s + i.amount, 0);
  }

  function expenseForMonth(monthIdx: number, year: number) {
    return allExpenses.filter((e) => {
      const d = new Date(e.date);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === monthIdx;
    }).reduce((s, e) => s + e.amount, 0);
  }

  const totalIncome = paidIncomes.reduce((s, i) => s + i.amount, 0);
  const totalExpense = allExpenses.reduce((s, e) => s + e.amount, 0);
  const saldo = totalIncome - totalExpense;
  const activeMembers = members.filter((m) => m.status === "active").length;

  const incomeThisMonth = incomeForMonth(currentMonth, currentYear);
  const incomePrevMonth = incomeForMonth(prevMonth, prevMonthYear);
  const expenseThisMonth = expenseForMonth(currentMonth, currentYear);
  const expensePrevMonth = expenseForMonth(prevMonth, prevMonthYear);

  // ── % anggota aktif sudah bayar bulan ini ──────────────────────────────
  const paidMembersThisMonth = new Set(
    paidIncomes.filter((inc) => {
      if (inc.date) {
        const d = new Date(inc.date);
        if (!Number.isNaN(d.getTime())) return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      const fallback = getMonthIndexFromIncome(inc.month);
      return inc.year === currentYear && fallback === currentMonth;
    }).map((inc) => inc.memberId)
  ).size;
  const paidPct = activeMembers > 0 ? Math.round((paidMembersThisMonth / activeMembers) * 100) : 0;

  // ── Bar chart data (monthly) ───────────────────────────────────────────
  const chartData = MONTHS.map((month, monthIndex) => ({
    month: month.substring(0, 3),
    pemasukan: incomeForMonth(monthIndex, currentYear),
    pengeluaran: expenseForMonth(monthIndex, currentYear),
  }));

  // ── Saldo trend (running balance over months) ─────────────────────────
  let running = (() => {
    const before = paidIncomes.reduce((s, inc) => {
      const d = inc.date ? new Date(inc.date) : new Date(inc.year, getMonthIndexFromIncome(inc.month), 1);
      return !Number.isNaN(d.getTime()) && d.getFullYear() < currentYear ? s + inc.amount : s;
    }, 0) - allExpenses.reduce((s, e) => {
      const d = new Date(e.date);
      return !Number.isNaN(d.getTime()) && d.getFullYear() < currentYear ? s + e.amount : s;
    }, 0);
    return before;
  })();
  const saldoTrend = MONTHS.map((month, idx) => {
    running += incomeForMonth(idx, currentYear) - expenseForMonth(idx, currentYear);
    return { month: month.substring(0, 3), saldo: running };
  });

  // ── Pie chart: income by bidang usaha ─────────────────────────────────
  const memberById = new Map(members.map((m) => [m.id, m]));
  const bidangMap = new Map<string, number>();
  paidIncomes.forEach((inc) => {
    const bidang = (memberById.get(inc.memberId)?.bidangUsaha?.trim() || "LAINNYA").toUpperCase();
    bidangMap.set(bidang, (bidangMap.get(bidang) || 0) + inc.amount);
  });
  const pieData = [...bidangMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // ── Latest transactions ────────────────────────────────────────────────
  const latestPaidIncomes = [...paidIncomes]
    .sort((a, b) => {
      const aTime = new Date(a.date || `${a.year}-${String(getMonthIndexFromIncome(a.month) + 1).padStart(2, "0")}-01`).getTime();
      const bTime = new Date(b.date || `${b.year}-${String(getMonthIndexFromIncome(b.month) + 1).padStart(2, "0")}-01`).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  const latestExpenses = [...allExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const stats = [
    {
      title: "Pemasukan Bulan Ini",
      value: formatCurrency(incomeThisMonth),
      sub: "Total: " + formatCurrency(totalIncome),
      icon: ArrowDownCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: { current: incomeThisMonth, previous: incomePrevMonth },
    },
    {
      title: "Pengeluaran Bulan Ini",
      value: formatCurrency(expenseThisMonth),
      sub: "Total: " + formatCurrency(totalExpense),
      icon: ArrowUpCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      trend: { current: expenseThisMonth, previous: expensePrevMonth },
    },
    {
      title: "Saldo Kas",
      value: formatCurrency(saldo),
      sub: saldo >= 0 ? "Posisi aman" : "Defisit",
      icon: Wallet,
      color: saldo >= 0 ? "text-blue-600" : "text-red-500",
      bg: "bg-blue-50",
      trend: null,
    },
    {
      title: "Anggota Aktif",
      value: String(activeMembers),
      sub: `${paidMembersThisMonth} sudah bayar bulan ini`,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
      trend: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm">Ringkasan keuangan — {MONTHS[currentMonth]} {currentYear}</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden">
            <CardContent className="p-0">
              <div className={`${stat.bg} px-5 pt-4 pb-3`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">{stat.title}</p>
                    <p className="text-xl font-bold mt-0.5 truncate">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color} opacity-70 shrink-0 ml-2`} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground truncate">{stat.sub}</p>
                  {stat.trend && <TrendBadge current={stat.trend.current} previous={stat.trend.previous} />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Iuran bulan ini progress ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Kepatuhan Iuran — {MONTHS[currentMonth]} {currentYear}</p>
            <span className="text-sm font-bold text-blue-700">{paidPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${paidPct}%`,
                background: paidPct >= 80 ? "#16a34a" : paidPct >= 50 ? "#d97706" : "#dc2626",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {paidMembersThisMonth} dari {activeMembers} anggota aktif telah membayar
          </p>
        </CardContent>
      </Card>

      {/* ── Bar chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grafik Pemasukan & Pengeluaran {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatShortCurrency} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="pemasukan" name="Pemasukan" fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Saldo Trend + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren Saldo {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={saldoTrend}>
                  <defs>
                    <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#003087" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#003087" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatShortCurrency} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#003087" strokeWidth={2} fill="url(#saldoGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Iuran per Bidang Usaha</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Belum ada data pemasukan.</p>
            ) : (
              <div className="h-56 flex items-center">
                <ResponsiveContainer width="55%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-52 text-xs pl-2">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{entry.name}</span>
                      <span className="ml-auto font-medium tabular-nums shrink-0">{formatShortCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Latest Transactions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pemasukan Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {latestPaidIncomes.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{inc.memberName}</p>
                    <p className="text-xs text-muted-foreground">{inc.month} {inc.year}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 ml-2 shrink-0">{formatCurrency(inc.amount)}</span>
                </div>
              ))}
              {latestPaidIncomes.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada pemasukan lunas.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengeluaran Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {latestExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{exp.type}</p>
                    <p className="text-xs text-muted-foreground">{exp.spmNumber}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-500 ml-2 shrink-0">{formatCurrency(exp.amount)}</span>
                </div>
              ))}
              {latestExpenses.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada pengeluaran.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
