import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Save, Clock } from "lucide-react";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type Manicure = { id: number; nome: string; especialidades: string[]; horarios_disponiveis: Record<string, string>; bio: string; ativo: boolean; role: string; };

const DIAS_SEMANA = ["ter", "qua", "qui", "sex", "sab"];
const DIAS_LABELS: Record<string, string> = { ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado" };

const emptyForm = { nome: "", especialidades: [] as string[], horarios_disponiveis: {} as Record<string, string>, bio: "", ativo: true };

export const EquipeManager = ({ token }: { token: string }) => {
  const [manicures, setManicures] = useState<Manicure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const fetchManicures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/manicures`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setManicures(d.manicures || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchManicures(); }, [fetchManicures]);

  const openNew = () => {
    setEditId(null);
    const defaultHorarios: Record<string, string> = {};
    DIAS_SEMANA.forEach(d => { defaultHorarios[d] = "09:00-18:00"; });
    setForm({ ...emptyForm, horarios_disponiveis: defaultHorarios });
    setShowModal(true);
  };

  const openEdit = (m: Manicure) => {
    setEditId(m.id);
    setForm({
      nome: m.nome,
      especialidades: m.especialidades || [],
      horarios_disponiveis: m.horarios_disponiveis || {},
      bio: m.bio || "",
      ativo: m.ativo,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setMsg("");
    try {
      const url = editId ? `${AGENT_BASE}/admin/manicures/${editId}` : `${AGENT_BASE}/admin/manicures`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Erro ao salvar");
      setMsg(editId ? "✅ Profissional atualizada!" : "✅ Profissional cadastrada!");
      setShowModal(false);
      await fetchManicures();
    } catch (e) { setMsg("❌ " + (e as Error).message); }
    finally { setSaving(false); setTimeout(() => setMsg(""), 3000); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Desativar esta profissional?")) return;
    try {
      await fetch(`${AGENT_BASE}/admin/manicures/${id}`, { method: "DELETE", headers: headers() });
      setMsg("✅ Profissional desativada!"); await fetchManicures();
    } catch (e) { setMsg("❌ Erro ao desativar"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const toggleHorarioDia = (dia: string) => {
    const h = { ...form.horarios_disponiveis };
    if (h[dia]) { delete h[dia]; } else { h[dia] = "09:00-18:00"; }
    setForm({ ...form, horarios_disponiveis: h });
  };

  const setHorarioDia = (dia: string, val: string) => {
    setForm({ ...form, horarios_disponiveis: { ...form.horarios_disponiveis, [dia]: val } });
  };

  if (loading) return <div className="text-white/30 text-sm text-center py-8">Carregando equipe...</div>;

  return (
    <div>
      {msg && <div className="mb-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{msg}</div>}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Equipe ({manicures.filter(m => m.ativo).length} ativas)</h2>
        <button onClick={openNew} className="h-9 px-4 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium flex items-center gap-1.5 hover:bg-green-500/25 transition-all"><Plus className="h-4 w-4" />Nova Profissional</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {manicures.map(m => (
          <div key={m.id} className={`backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 ${!m.ativo ? "opacity-40" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  {m.nome}
                  {m.role === "admin" && <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full">Admin</span>}
                </h3>
                <p className="text-white/30 text-xs mt-0.5">{m.bio || "Sem bio"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-all"><Pencil className="h-3.5 w-3.5" /></button>
                {m.ativo && <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            {m.horarios_disponiveis && Object.keys(m.horarios_disponiveis).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(m.horarios_disponiveis).map(([dia, hr]) => (
                  <span key={dia} className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Clock className="h-3 w-3" />{DIAS_LABELS[dia] || dia}: {hr as string}
                  </span>
                ))}
              </div>
            )}
            <span className={`inline-block mt-3 text-xs px-2 py-1 rounded-full ${m.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{m.ativo ? "Ativa" : "Inativa"}</span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2a3a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">{editId ? "Editar Profissional" : "Nova Profissional"}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Nome</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Bio</label>
                <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40 resize-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block">Horários de Trabalho (Terça a Sábado)</label>
                <div className="space-y-2">
                  {DIAS_SEMANA.map(dia => (
                    <div key={dia} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 min-w-[80px]">
                        <input type="checkbox" checked={!!form.horarios_disponiveis[dia]} onChange={() => toggleHorarioDia(dia)} className="rounded accent-green-500" />
                        <span className="text-white/60 text-xs">{DIAS_LABELS[dia]}</span>
                      </label>
                      {form.horarios_disponiveis[dia] && (
                        <input value={form.horarios_disponiveis[dia]} onChange={e => setHorarioDia(dia, e.target.value)} placeholder="09:00-18:00" className="flex-1 h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-xs outline-none focus:border-green-500/40" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.nome} className="w-full h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 transition-all">
                {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="h-4 w-4" />{editId ? "Salvar" : "Cadastrar"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
