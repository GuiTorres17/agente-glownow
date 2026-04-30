import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, RefreshCw, DollarSign, Users, CheckCircle2,
  Clock, AlertCircle, CalendarDays, Sparkles, TrendingUp,
  CreditCard, ChevronRight, ChevronLeft, LayoutGrid, List
} from "lucide-react";
import { cn } from "@/lib/utils";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type Agendamento = {
  id: number; horario: string; cliente_nome: string; cliente_cel: string;
  servico_nome: string; servico_preco: number; manicure_nome: string;
  status: string; sinal_pago: number; sinal_confirmado?: boolean;
};

type DashboardData = {
  data: string; agendamentos: Agendamento[];
  kpis: { faturamento_previsto: number; confirmados: number; pendentes: number; total_clientes: number; };
};

type DiaResumo = { dia: number; data: string; total: number; confirmados: number; pendentes: number; faturamento: number; };
type MonthlyData = { mes: number; ano: number; dias: DiaResumo[]; };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const formatDateBR = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
const parseDateBR = (s: string) => { const [d,m,y] = s.split("/").map(Number); return new Date(y, m-1, d); };

const AdminPanel = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("admin_token");
  const [view, setView] = useState<"day"|"month">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDay = useCallback(async (date?: Date) => {
    if (!token) { navigate("/admin/login"); return; }
    setLoading(true); setError("");
    const d = date || selectedDate;
    try {
      const res = await fetch(`${AGENT_BASE}/admin/dashboard?date=${encodeURIComponent(formatDateBR(d))}`, { headers: authHeaders() });
      if (res.status === 401) { localStorage.removeItem("admin_token"); navigate("/admin/login"); return; }
      if (!res.ok) throw new Error("Erro ao carregar dados");
      setDashboard(await res.json());
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [token, navigate, selectedDate, authHeaders]);

  const fetchMonth = useCallback(async (month?: number, year?: number) => {
    if (!token) { navigate("/admin/login"); return; }
    setLoading(true); setError("");
    const m = month ?? selectedDate.getMonth() + 1;
    const y = year ?? selectedDate.getFullYear();
    try {
      const res = await fetch(`${AGENT_BASE}/admin/monthly?month=${m}&year=${y}`, { headers: authHeaders() });
      if (res.status === 401) { localStorage.removeItem("admin_token"); navigate("/admin/login"); return; }
      if (!res.ok) throw new Error("Erro ao carregar dados mensais");
      setMonthly(await res.json());
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [token, navigate, selectedDate, authHeaders]);

  useEffect(() => {
    if (!token) { navigate("/admin/login"); return; }
    if (view === "day") fetchDay(); else fetchMonth();
  }, [token, navigate]); // eslint-disable-line

  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate);
    if (view === "day") { d.setDate(d.getDate() + offset); } else { d.setMonth(d.getMonth() + offset); }
    setSelectedDate(d);
    if (view === "day") fetchDay(d); else fetchMonth(d.getMonth() + 1, d.getFullYear());
  };

  const goToday = () => { const d = new Date(); setSelectedDate(d); setView("day"); fetchDay(d); };

  const selectDayFromCalendar = (dia: DiaResumo) => {
    const d = parseDateBR(dia.data);
    setSelectedDate(d); setView("day"); fetchDay(d);
  };

  const handleLogout = async () => {
    try { await fetch(`${AGENT_BASE}/admin/logout`, { method: "POST", headers: authHeaders() }); } catch {}
    localStorage.removeItem("admin_token"); navigate("/");
  };

  const handleConfirmarSinal = async (id: number) => {
    if (!token) return;
    setConfirmandoId(id);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${AGENT_BASE}/admin/confirmar-sinal`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ agendamento_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao confirmar sinal");
      setSuccessMsg(`✅ Sinal de R$ ${data.sinal_pago?.toFixed(2) || '0.00'} confirmado com sucesso!`);
      setTimeout(() => setSuccessMsg(""), 4000);
      await fetchDay();
    } catch (err: any) { setError(err.message); } finally { setConfirmandoId(null); }
  };

  const now = new Date();
  const saudacao = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const isToday = formatDateBR(selectedDate) === formatDateBR(now);

  if (loading && !dashboard && !monthly) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1923] via-[#1a2a3a] to-[#0d2818] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-[3px] border-green-500/30 border-t-green-400 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Carregando painel...</p>
        </div>
      </div>
    );
  }

  // --- Calendar grid helpers ---
  const renderCalendar = () => {
    if (!monthly) return null;
    const firstDay = new Date(monthly.ano, monthly.mes - 1, 1).getDay();
    const cells: (DiaResumo | null)[] = Array(firstDay).fill(null).concat(monthly.dias);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-white/30 uppercase tracking-wider border-b border-white/[0.06]">{d}</div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} className="py-4 border-b border-r border-white/[0.03] bg-white/[0.01]" />;
            const isCurrentDay = cell.dia === now.getDate() && monthly.mes === now.getMonth() + 1 && monthly.ano === now.getFullYear();
            const hasAppts = cell.total > 0;
            return (
              <button key={cell.dia} onClick={() => selectDayFromCalendar(cell)}
                className={cn(
                  "py-3 px-2 border-b border-r border-white/[0.03] text-left transition-all duration-200 hover:bg-white/[0.06] group relative",
                  isCurrentDay && "bg-green-500/10",
                )}>
                <span className={cn("text-sm font-medium", isCurrentDay ? "text-green-400" : "text-white/70")}>{cell.dia}</span>
                {hasAppts && (
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cell.pendentes > 0 ? "bg-amber-400" : "bg-emerald-400")} />
                      <span className="text-[10px] text-white/40">{cell.total} agend.</span>
                    </div>
                    <p className="text-[10px] text-green-400/60">R$ {cell.faturamento.toFixed(0)}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1923] via-[#1a2a3a] to-[#0d2818] relative overflow-x-hidden">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-green-500/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-green-400" />
              <h1 className="text-2xl font-bold text-white">{saudacao}!</h1>
            </div>
            <p className="text-white/40 text-sm">Painel Administrativo — Lino Esmalteria</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setView("day"); fetchDay(); }} className={cn("h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border", view==="day" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white")}><List className="h-3.5 w-3.5" />Diário</button>
            <button onClick={() => { setView("month"); fetchMonth(); }} className={cn("h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border", view==="month" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white")}><LayoutGrid className="h-3.5 w-3.5" />Mensal</button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button onClick={handleLogout} className="h-9 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium flex items-center gap-1.5 transition-all duration-200"><LogOut className="h-3.5 w-3.5" />Sair</button>
          </div>
        </header>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-fade-in-up">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
          </div>
        )}

        {successMsg && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2 animate-fade-in-up">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />{successMsg}
          </div>
        )}

        {/* Date navigator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigateDate(-1)} className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] flex items-center justify-center transition-all"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08]">
              <CalendarDays className="h-4 w-4 text-green-400" />
              <span className="text-sm font-semibold text-white">
                {view === "day" ? (
                  <>{isToday && <span className="text-green-400 mr-1">Hoje —</span>}{formatDateBR(selectedDate)}</>
                ) : (
                  <>{MESES[selectedDate.getMonth()]} {selectedDate.getFullYear()}</>
                )}
              </span>
            </div>
            <button onClick={() => navigateDate(1)} className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] flex items-center justify-center transition-all"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            {!isToday && <button onClick={goToday} className="h-9 px-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-all">Hoje</button>}
            <button onClick={() => view==="day" ? fetchDay() : fetchMonth()} disabled={loading} className="h-9 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Atualizar
            </button>
          </div>
        </div>

        {/* ===== DAY VIEW ===== */}
        {view === "day" && dashboard && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiCard icon={<DollarSign className="h-5 w-5 text-green-400" />} extra={<TrendingUp className="h-4 w-4 text-green-400/50" />} value={`R$ ${dashboard.kpis.faturamento_previsto.toLocaleString("pt-BR",{minimumFractionDigits:2})}`} label="Faturamento Previsto" color="green" />
              <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} value={String(dashboard.kpis.confirmados)} label="Confirmados" color="emerald" />
              <KpiCard icon={<Clock className="h-5 w-5 text-amber-400" />} value={String(dashboard.kpis.pendentes)} label="Pendentes" color="amber" />
              <KpiCard icon={<Users className="h-5 w-5 text-blue-400" />} value={String(dashboard.kpis.total_clientes)} label="Total de Clientes" color="blue" />
            </div>

            {/* Agenda table */}
            <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><CalendarDays size={18} className="text-green-400" />Agenda — {dashboard.data}</h2>
                <span className="text-xs text-white/30">{dashboard.agendamentos.length} agendamento(s)</span>
              </div>
              {dashboard.agendamentos.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <CalendarDays className="h-12 w-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40 text-sm">Nenhum agendamento nesta data</p>
                  <p className="text-white/20 text-xs mt-1">Dia livre! 😉</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {dashboard.agendamentos.map((a) => {
                    const isPago = a.sinal_confirmado || (a.sinal_pago && a.sinal_pago > 0);
                    return (
                      <div key={a.id} className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg font-bold text-white font-mono w-14 flex-shrink-0">{a.horario}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{a.cliente_nome}</p>
                            <p className="text-xs text-white/30">{a.cliente_cel || "Sem celular"}</p>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/70">{a.servico_nome}</p>
                          <p className="text-xs text-white/30">com {a.manicure_nome} — R$ {a.servico_preco.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPago ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                              <CheckCircle2 className="h-3.5 w-3.5" />Confirmado — R$ {a.sinal_pago.toFixed(2)}
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg"><Clock className="h-3.5 w-3.5" />Aguardando</span>
                              <button onClick={() => handleConfirmarSinal(a.id)} disabled={confirmandoId === a.id}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all disabled:opacity-50">
                                {confirmandoId === a.id ? <div className="h-3.5 w-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                                Confirmar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== MONTH VIEW ===== */}
        {view === "month" && monthly && (
          <>
            {/* Monthly KPIs summary */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <KpiCard icon={<CalendarDays className="h-5 w-5 text-green-400" />} value={String(monthly.dias.reduce((s,d) => s + d.total, 0))} label="Total de Agendamentos" color="green" />
              <KpiCard icon={<DollarSign className="h-5 w-5 text-emerald-400" />} value={`R$ ${monthly.dias.reduce((s,d) => s + d.faturamento, 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`} label="Faturamento do Mês" color="emerald" />
              <KpiCard icon={<Clock className="h-5 w-5 text-amber-400" />} value={String(monthly.dias.reduce((s,d) => s + d.pendentes, 0))} label="Pendentes no Mês" color="amber" />
            </div>
            {renderCalendar()}
          </>
        )}

        <footer className="mt-8 text-center"><p className="text-xs text-white/15">Lino Esmalteria — Painel Administrativo v2.0</p></footer>
      </div>
    </div>
  );
};

// Reusable KPI card component
const KpiCard = ({ icon, extra, value, label, color }: { icon: React.ReactNode; extra?: React.ReactNode; value: string; label: string; color: string }) => (
  <div className="group backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300">
    <div className="flex items-center justify-between mb-3">
      <div className={`h-10 w-10 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>{icon}</div>
      {extra}
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-white/40 mt-1">{label}</p>
  </div>
);

export default AdminPanel;
