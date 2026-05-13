import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { CalendarDays, BarChart3 } from "lucide-react";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type DayData = { dia: string; data: string; total: number; confirmados: number; pendentes: number; faturamento: number; };

const COLORS = ["#22c55e", "#f59e0b", "#6366f1"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const tooltipStyle = { background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" };

export const DashboardCharts = ({ token }: { token: string }) => {
  const [chartView, setChartView] = useState<"week" | "month">("week");
  const [weekly, setWeekly] = useState<DayData[]>([]);
  const [monthly, setMonthly] = useState<DayData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchWeekly = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_BASE}/admin/weekly-summary`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setWeekly(d.dias || []); }
    } catch (e) { console.error(e); }
  }, [headers]);

  const fetchMonthly = useCallback(async (month?: number, year?: number) => {
    const m = month ?? selectedMonth.getMonth() + 1;
    const y = year ?? selectedMonth.getFullYear();
    try {
      const res = await fetch(`${AGENT_BASE}/admin/monthly?month=${m}&year=${y}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        const dias = (d.dias || []).map((day: DayData & { dia?: number }) => ({
          ...day,
          dia: String(day.dia || day.data?.split("/")[0] || ""),
        }));
        setMonthly(dias);
      }
    } catch (e) { console.error(e); }
  }, [headers, selectedMonth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWeekly(), fetchMonthly()]).finally(() => setLoading(false));
  }, [fetchWeekly, fetchMonthly]);

  const switchToMonth = (offset: number) => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(d);
    fetchMonthly(d.getMonth() + 1, d.getFullYear());
  };

  if (loading) return <div className="text-white/30 text-sm text-center py-8">Carregando gráficos...</div>;

  const data = chartView === "week" ? weekly : monthly;
  const totalConf = data.reduce((s, d) => s + d.confirmados, 0);
  const totalPend = data.reduce((s, d) => s + d.pendentes, 0);
  const totalLivre = Math.max(0, data.length * 6 - totalConf - totalPend);
  const totalFat = data.reduce((s, d) => s + d.faturamento, 0);
  const totalAgend = data.reduce((s, d) => s + d.total, 0);
  const pieData = [
    { name: "Confirmados", value: totalConf },
    { name: "Pendentes", value: totalPend },
    { name: "Livres", value: totalLivre },
  ];
  const periodLabel = chartView === "week" ? "Últimos 7 dias" : `${MESES[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;

  return (
    <div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40">Faturamento Previsto</p>
          <p className="text-xl font-bold text-green-400 mt-1">R$ {totalFat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40">Total Agendamentos</p>
          <p className="text-xl font-bold text-white mt-1">{totalAgend}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40">Confirmados</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{totalConf}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40">Pendentes</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{totalPend}</p>
        </div>
      </div>

      {/* Period toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setChartView("week")} className={cn("h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border", chartView === "week" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white")}>
            <BarChart3 className="h-3.5 w-3.5" />Semanal
          </button>
          <button onClick={() => setChartView("month")} className={cn("h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border", chartView === "month" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white")}>
            <CalendarDays className="h-3.5 w-3.5" />Mensal
          </button>
        </div>
        {chartView === "month" && (
          <div className="flex items-center gap-2">
            <button onClick={() => switchToMonth(-1)} className="h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white text-xs transition-all">←</button>
            <span className="text-xs text-white/60 min-w-[120px] text-center">{periodLabel}</span>
            <button onClick={() => switchToMonth(1)} className="h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white text-xs transition-all">→</button>
          </div>
        )}
        {chartView === "week" && <span className="text-xs text-white/40">{periodLabel}</span>}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Bar Chart */}
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-4">💰 Faturamento</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
              <Bar dataKey="faturamento" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-4">📊 Taxa de Ocupação</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value"
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart */}
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white/70 mb-4">📈 Agendamentos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
              <Line type="monotone" dataKey="confirmados" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Confirmados" />
              <Line type="monotone" dataKey="pendentes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Pendentes" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
