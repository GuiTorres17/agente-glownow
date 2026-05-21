import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  CalendarDays, BarChart3, TrendingUp, Users, Scissors,
  UserCheck, DollarSign, RefreshCw, AlertTriangle, Sparkles,
  Activity, Target,
} from "lucide-react";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type DayData = { dia: string; data: string; total: number; confirmados: number; pendentes: number; faturamento: number; };
type Stats = { total_clientes: number; servicos_ativos: number; profissionais_ativas: number; faturamento_mes: number; agendamentos_mes: number; };

const COLORS_PIE = ["#22c55e", "#f59e0b", "#6366f1"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const tooltipStyle = {
  background: "rgba(15, 25, 35, 0.95)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 13,
  padding: "10px 14px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

/* ─── Animated counter hook ─── */
const useCountUp = (end: number, duration = 1200) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (end === 0) { setVal(0); return; }
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return val;
};

/* ─── Skeleton loader ─── */
const SkeletonCard = () => (
  <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
    <div className="h-4 w-20 bg-white/10 rounded mb-3" />
    <div className="h-7 w-32 bg-white/10 rounded mb-2" />
    <div className="h-3 w-24 bg-white/[0.06] rounded" />
  </div>
);

const SkeletonChart = ({ className = "" }: { className?: string }) => (
  <div className={cn("backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 animate-pulse", className)}>
    <div className="h-4 w-28 bg-white/10 rounded mb-6" />
    <div className="flex items-end gap-2 h-[180px]">
      {[40, 65, 35, 80, 55, 70, 45].map((h, i) => (
        <div key={i} className="flex-1 bg-white/[0.06] rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

/* ─── Mini KPI Card ─── */
const MiniKpi = ({ icon, label, value, color, prefix = "", suffix = "" }: {
  icon: React.ReactNode; label: string; value: number; color: string; prefix?: string; suffix?: string;
}) => {
  const animated = useCountUp(value);
  return (
    <div className="group backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-3">
        <div className={`h-10 w-10 rounded-xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
          {icon}
        </div>
        <TrendingUp className={`h-4 w-4 text-${color}-400/40 group-hover:text-${color}-400/70 transition-colors`} />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">
        {prefix}{typeof value === 'number' && value % 1 !== 0 ? animated.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : animated.toLocaleString("pt-BR")}{suffix}
      </p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                            */
/* ═══════════════════════════════════════════════════════════ */
export const DashboardCharts = ({ token }: { token: string }) => {
  const [chartView, setChartView] = useState<"week" | "month">("week");
  const [weekly, setWeekly] = useState<DayData[]>([]);
  const [monthly, setMonthly] = useState<DayData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchWeekly = useCallback(async () => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/weekly-summary`, { headers: headers(), signal: ctrl.signal });
      if (res.ok) { const d = await res.json(); setWeekly(d.dias || []); }
      else throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      if (e.name === "AbortError") throw new Error("Timeout — o servidor demorou para responder");
      throw e;
    } finally { clearTimeout(timeout); }
  }, [headers]);

  const fetchMonthly = useCallback(async (month?: number, year?: number) => {
    const m = month ?? selectedMonth.getMonth() + 1;
    const y = year ?? selectedMonth.getFullYear();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/monthly?month=${m}&year=${y}`, { headers: headers(), signal: ctrl.signal });
      if (res.ok) {
        const d = await res.json();
        const dias = (d.dias || []).map((day: DayData & { dia?: number }) => ({
          ...day,
          dia: String(day.dia || day.data?.split("/")[0] || ""),
        }));
        setMonthly(dias);
      }
    } catch (_) { /* monthly is secondary, don't break */ }
    finally { clearTimeout(timeout); }
  }, [headers, selectedMonth]);

  const fetchStats = useCallback(async () => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/stats`, { headers: headers(), signal: ctrl.signal });
      if (res.ok) setStats(await res.json());
    } catch (_) { /* stats is optional */ }
    finally { clearTimeout(timeout); }
  }, [headers]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchWeekly(), fetchMonthly(), fetchStats()]);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [fetchWeekly, fetchMonthly, fetchStats]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const switchToMonth = (offset: number) => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(d);
    fetchMonthly(d.getMonth() + 1, d.getFullYear());
  };

  /* ─── Loading state ─── */
  if (loading) return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonChart className="lg:col-span-2" />
      <p className="text-center text-white/20 text-xs flex items-center justify-center gap-2">
        <div className="h-4 w-4 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
        Conectando ao servidor... Pode levar alguns segundos na primeira vez.
      </p>
    </div>
  );

  /* ─── Error state ─── */
  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
      <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-white font-semibold mb-1">Ops, algo deu errado</h3>
      <p className="text-white/40 text-sm mb-6 text-center max-w-sm">{error}</p>
      <button onClick={loadAll}
        className="h-10 px-5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-medium flex items-center gap-2 hover:bg-green-500/25 transition-all">
        <RefreshCw className="h-4 w-4" />Tentar novamente
      </button>
    </div>
  );

  /* ─── Data ─── */
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
  const hasAnyData = totalAgend > 0 || totalFat > 0;
  const periodLabel = chartView === "week" ? "Últimos 7 dias" : `${MESES[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* ─── Stats KPI Row ─── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MiniKpi icon={<Users className="h-5 w-5 text-blue-400" />} label="Clientes Cadastrados" value={stats.total_clientes} color="blue" />
          <MiniKpi icon={<Scissors className="h-5 w-5 text-purple-400" />} label="Serviços Ativos" value={stats.servicos_ativos} color="purple" />
          <MiniKpi icon={<UserCheck className="h-5 w-5 text-emerald-400" />} label="Profissionais" value={stats.profissionais_ativas} color="emerald" />
          <MiniKpi icon={<DollarSign className="h-5 w-5 text-green-400" />} label="Faturamento do Mês" value={stats.faturamento_mes} color="green" prefix="R$ " />
          <MiniKpi icon={<CalendarDays className="h-5 w-5 text-amber-400" />} label="Agendamentos do Mês" value={stats.agendamentos_mes} color="amber" />
        </div>
      )}

      {/* ─── Period KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKpi icon={<DollarSign className="h-5 w-5 text-green-400" />} label="Faturamento Previsto" value={totalFat} color="green" prefix="R$ " />
        <MiniKpi icon={<Activity className="h-5 w-5 text-white" />} label="Total Agendamentos" value={totalAgend} color="white" />
        <MiniKpi icon={<Target className="h-5 w-5 text-emerald-400" />} label="Confirmados" value={totalConf} color="emerald" />
        <MiniKpi icon={<AlertTriangle className="h-5 w-5 text-amber-400" />} label="Pendentes" value={totalPend} color="amber" />
      </div>

      {/* ─── Period toggle + refresh ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setChartView("week")} className={cn("h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border", chartView === "week" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white")}>
            <BarChart3 className="h-3.5 w-3.5" />Semanal
          </button>
          <button onClick={() => setChartView("month")} className={cn("h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border", chartView === "month" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white")}>
            <CalendarDays className="h-3.5 w-3.5" />Mensal
          </button>
          <button onClick={loadAll} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />Atualizar
          </button>
        </div>
        <div className="flex items-center gap-2">
          {chartView === "month" && (
            <>
              <button onClick={() => switchToMonth(-1)} className="h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white text-xs transition-all">←</button>
              <span className="text-xs text-white/60 min-w-[120px] text-center">{periodLabel}</span>
              <button onClick={() => switchToMonth(1)} className="h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white text-xs transition-all">→</button>
            </>
          )}
          {chartView === "week" && <span className="text-xs text-white/40">{periodLabel}</span>}
        </div>
      </div>

      {/* ─── Empty state ─── */}
      {!hasAnyData && (
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-12 text-center">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="h-10 w-10 text-green-400/60" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nenhum agendamento no período</h3>
          <p className="text-white/40 text-sm max-w-md mx-auto mb-4">
            {chartView === "week"
              ? "A semana está tranquila! Que tal divulgar seus serviços nas redes sociais para atrair mais clientes? 💅"
              : "Nenhum agendamento registrado neste mês. Explore o módulo de Serviços para conferir o cardápio disponível."}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-white/30">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{stats?.total_clientes || 0} clientes</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Scissors className="h-3.5 w-3.5" />{stats?.servicos_ativos || 0} serviços</span>
            <span>•</span>
            <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" />{stats?.profissionais_ativas || 0} profissionais</span>
          </div>
        </div>
      )}

      {/* ─── Charts grid ─── */}
      {hasAnyData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Area Chart — Faturamento */}
          <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300">
            <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-green-500/15 flex items-center justify-center"><DollarSign className="h-3.5 w-3.5 text-green-400" /></span>
              Faturamento
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
                <Area type="monotone" dataKey="faturamento" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradFat)"
                  animationBegin={200} animationDuration={1200} animationEasing="ease-out" dot={{ r: 4, fill: "#22c55e", strokeWidth: 2, stroke: "#0f1923" }} activeDot={{ r: 6, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart — Ocupação */}
          <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300">
            <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-indigo-500/15 flex items-center justify-center"><Target className="h-3.5 w-3.5 text-indigo-400" /></span>
              Taxa de Ocupação
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value"
                  animationBegin={400} animationDuration={1000} animationEasing="ease-out"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart — Agendamentos */}
          <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2 hover:border-white/[0.12] transition-all duration-300">
            <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center"><Activity className="h-3.5 w-3.5 text-amber-400" /></span>
              Agendamentos
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <defs>
                  <linearGradient id="gradConf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                <Line type="monotone" dataKey="confirmados" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e", strokeWidth: 2, stroke: "#0f1923" }} name="Confirmados"
                  animationBegin={600} animationDuration={1000} animationEasing="ease-out" />
                <Line type="monotone" dataKey="pendentes" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#0f1923" }} name="Pendentes"
                  animationBegin={800} animationDuration={1000} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
