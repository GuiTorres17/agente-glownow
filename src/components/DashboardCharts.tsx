import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type WeekDay = { dia: string; data: string; total: number; confirmados: number; pendentes: number; faturamento: number; };

const COLORS = ["#22c55e", "#f59e0b", "#6366f1", "#ec4899"];

export const DashboardCharts = ({ token }: { token: string }) => {
  const [weekly, setWeekly] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/weekly-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWeekly(data.dias || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchWeekly(); }, [fetchWeekly]);

  if (loading) return <div className="text-white/30 text-sm text-center py-8">Carregando gráficos...</div>;

  const totalConf = weekly.reduce((s, d) => s + d.confirmados, 0);
  const totalPend = weekly.reduce((s, d) => s + d.pendentes, 0);
  const totalLivre = Math.max(0, weekly.length * 6 - totalConf - totalPend);
  const pieData = [
    { name: "Confirmados", value: totalConf },
    { name: "Pendentes", value: totalPend },
    { name: "Livres", value: totalLivre },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Bar Chart — Faturamento semanal */}
      <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4">💰 Faturamento — Últimos 7 dias</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
            <Bar dataKey="faturamento" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart — Taxa de ocupação */}
      <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4">📊 Taxa de Ocupação — Semana</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Line Chart — Agendamentos semanal */}
      <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-white/70 mb-4">📈 Agendamentos — Últimos 7 dias</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }} />
            <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
            <Line type="monotone" dataKey="confirmados" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Confirmados" />
            <Line type="monotone" dataKey="pendentes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Pendentes" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
