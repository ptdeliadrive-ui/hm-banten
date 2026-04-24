import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/store";
import { useIncomes } from "@/lib/income-context";
import { useFinance } from "@/lib/finance-context";
import { useMembers } from "@/lib/member-context";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function getMonthIndexFromIncome(monthLabel?: string) {
  if (!monthLabel) return -1;
  const normalized = monthLabel.trim().toLowerCase();
  return MONTHS.findIndex((m) => m.toLowerCase() === normalized);
}

const Dashboard = () => {
  const { incomes } = useIncomes();
  const { allExpenses } = useFinance();
  const { members } = useMembers();

  const totalIncome = incomes.filter((i) => i.status === "lunas").reduce((s, i) => s + i.amount, 0);
  const totalExpense = allExpenses.reduce((s, e) => s + e.amount, 0);
  const saldo = totalIncome - totalExpense;
  const activeMembers = members.filter((m) => m.status === "active").length;

  const currentYear = new Date().getFullYear();
  const chartData = MONTHS.map((month, monthIndex) => {
    const pemasukan = incomes
      .filter((income) => {
        if (income.status !== "lunas") return false;

        if (income.date) {
          const d = new Date(income.date);
          if (!Number.isNaN(d.getTime())) {
            return d.getFullYear() === currentYear && d.getMonth() === monthIndex;
          }
        }

        const fallbackMonth = getMonthIndexFromIncome(income.month);
        return income.year === currentYear && fallbackMonth === monthIndex;
      })
      .reduce((sum, income) => sum + income.amount, 0);

    const pengeluaran = allExpenses
      .filter((expense) => {
        const d = new Date(expense.date);
        if (Number.isNaN(d.getTime())) return false;
        return d.getFullYear() === currentYear && d.getMonth() === monthIndex;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    return { month: month.substring(0, 3), pemasukan, pengeluaran };
  });

  const latestPaidIncomes = [...incomes]
    .filter((i) => i.status === "lunas")
    .sort((a, b) => {
      const aTime = new Date(a.date || `${a.year}-${String(getMonthIndexFromIncome(a.month) + 1).padStart(2, "0")}-01`).getTime();
      const bTime = new Date(b.date || `${b.year}-${String(getMonthIndexFromIncome(b.month) + 1).padStart(2, "0")}-01`).getTime();
      return bTime - aTime;
    })
    .slice(0, 4);

  const latestExpenses = [...allExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const stats = [
    { title: 'Total Pemasukan', value: formatCurrency(totalIncome), icon: ArrowDownCircle, color: 'text-accent' },
    { title: 'Total Pengeluaran', value: formatCurrency(totalExpense), icon: ArrowUpCircle, color: 'text-destructive' },
    { title: 'Saldo Kas', value: formatCurrency(saldo), icon: Wallet, color: 'text-primary' },
    { title: 'Anggota Aktif', value: String(activeMembers), icon: Users, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm">Ringkasan keuangan organisasi</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grafik Keuangan Bulanan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="pemasukan" name="Pemasukan" fill="hsl(168, 56%, 42%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pengeluaran" name="Pengeluaran" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pemasukan Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {latestPaidIncomes.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{inc.memberName}</p>
                    <p className="text-xs text-muted-foreground">{inc.month} {inc.year}</p>
                  </div>
                  <span className="text-sm font-semibold text-accent">{formatCurrency(inc.amount)}</span>
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
            <div className="space-y-3">
              {latestExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{exp.type}</p>
                    <p className="text-xs text-muted-foreground">{exp.spmNumber}</p>
                  </div>
                  <span className="text-sm font-semibold text-destructive">{formatCurrency(exp.amount)}</span>
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
