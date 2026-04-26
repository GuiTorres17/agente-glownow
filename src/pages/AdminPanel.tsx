import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, RefreshCw, DollarSign, Users, CheckCircle2,
  Clock, AlertCircle, CalendarDays, Sparkles, TrendingUp,
  CreditCard, ChevronRight
} from "lucide-react";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type Agendamento = {
  id: number;
  horario: string;
  cliente_nome: string;
  cliente_cel: string;
  servico_nome: string;
  servico_preco: number;
  manicure_nome: string;
  status: string;
  sinal_pago: number;
};

type DashboardData = {
  data: string;
  agendamentos: Agendamento[];
  kpis: {
    faturamento_previsto: number;
    confirmados: number;
    pendentes: number;
    total_clientes: number;
  };
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);

  const token = localStorage.getItem("admin_token");

  const fetchDashboard = useCallback(async () => {
    if (!token) {
      navigate("/admin/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${AGENT_BASE}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        navigate("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const data: DashboardData = await res.json();
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || "Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchDashboard();
  }, [token, navigate, fetchDashboard]);

  const handleLogout = async () => {
    try {
      await fetch(`${AGENT_BASE}/admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
    localStorage.removeItem("admin_token");
    navigate("/");
  };

  const handleConfirmarSinal = async (agendamentoId: number) => {
    if (!token) return;
    setConfirmandoId(agendamentoId);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/confirmar-sinal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agendamento_id: agendamentoId }),
      });
      if (!res.ok) throw new Error("Erro ao confirmar sinal");
      // Recarregar dados
      await fetchDashboard();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirmandoId(null);
    }
  };

  const now = new Date();
  const saudacao = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1923] via-[#1a2a3a] to-[#0d2818] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-3 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1923] via-[#1a2a3a] to-[#0d2818] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-green-500/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-green-400" />
              <h1 className="text-2xl font-bold text-white">{saudacao}!</h1>
            </div>
            <p className="text-white/40 text-sm">
              Painel Administrativo — Lino Esmalteria
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="h-10 px-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={handleLogout}
              className="h-10 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-medium flex items-center gap-2 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-fade-in-up">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Date badge */}
        {dashboard && (
          <div className="flex items-center gap-2 mb-6">
            <CalendarDays className="h-4 w-4 text-green-400" />
            <span className="text-sm text-white/60">Agenda do dia</span>
            <span className="text-sm font-semibold text-white bg-white/[0.06] border border-white/[0.08] px-3 py-1 rounded-lg">
              {dashboard.data}
            </span>
          </div>
        )}

        {/* KPI Cards */}
        {dashboard && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Faturamento */}
            <div className="group backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <TrendingUp className="h-4 w-4 text-green-400/50" />
              </div>
              <p className="text-2xl font-bold text-white">
                R$ {dashboard.kpis.faturamento_previsto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-white/40 mt-1">Faturamento Previsto</p>
            </div>

            {/* Confirmados */}
            <div className="group backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{dashboard.kpis.confirmados}</p>
              <p className="text-xs text-white/40 mt-1">Confirmados</p>
            </div>

            {/* Pendentes */}
            <div className="group backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{dashboard.kpis.pendentes}</p>
              <p className="text-xs text-white/40 mt-1">Pendentes</p>
            </div>

            {/* Total Clientes */}
            <div className="group backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{dashboard.kpis.total_clientes}</p>
              <p className="text-xs text-white/40 mt-1">Total de Clientes</p>
            </div>
          </div>
        )}

        {/* Agenda Table */}
        {dashboard && (
          <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-green-400" size={18} />
                Agenda do Dia
              </h2>
              <span className="text-xs text-white/30">{dashboard.agendamentos.length} agendamento(s)</span>
            </div>

            {dashboard.agendamentos.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <CalendarDays className="h-12 w-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm">Nenhum agendamento para hoje</p>
                <p className="text-white/20 text-xs mt-1">Dia tranquilo! 😉</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {dashboard.agendamentos.map((a) => {
                  const isPago = a.sinal_pago && a.sinal_pago > 0;
                  const isConfirmando = confirmandoId === a.id;

                  return (
                    <div key={a.id} className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 hover:bg-white/[0.02] transition-colors duration-200">
                      {/* Horário */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg font-bold text-white font-mono w-14 flex-shrink-0">{a.horario}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{a.cliente_nome}</p>
                          <p className="text-xs text-white/30">{a.cliente_cel || "Sem celular"}</p>
                        </div>
                      </div>

                      {/* Serviço */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70">{a.servico_nome}</p>
                        <p className="text-xs text-white/30">com {a.manicure_nome} — R$ {a.servico_preco.toFixed(2)}</p>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-3">
                        {isPago ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirmado — R$ {a.sinal_pago.toFixed(2)}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                              <Clock className="h-3.5 w-3.5" />
                              Aguardando Sinal
                            </span>
                            <button
                              onClick={() => handleConfirmarSinal(a.id)}
                              disabled={isConfirmando}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all duration-200 disabled:opacity-50"
                            >
                              {isConfirmando ? (
                                <div className="h-3.5 w-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                              ) : (
                                <CreditCard className="h-3.5 w-3.5" />
                              )}
                              Confirmar
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-white/15">Lino Esmalteria — Painel Administrativo v1.0</p>
        </footer>
      </div>
    </div>
  );
};

export default AdminPanel;
