import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

type Servico = { id: number; categoria: string; nome: string; preco: number; duracao: number; descricao: string; ativo: boolean; };

const CATEGORIAS = [
  "Manicure e Pedicure", "Esmaltação em Gel & Banho de Gel",
  "Alongamento na Fibra de Vidro", "Outras Decorações",
  "Serviços à Parte", "Manutenção",
];

const emptyForm = { categoria: CATEGORIAS[0], nome: "", preco: 0, duracao: 60, descricao: "", ativo: true };

export const ServicosManager = ({ token }: { token: string }) => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const fetchServicos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/admin/servicos`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setServicos(d.servicos || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchServicos(); }, [fetchServicos]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s: Servico) => {
    setEditId(s.id);
    setForm({ categoria: s.categoria, nome: s.nome, preco: s.preco, duracao: s.duracao, descricao: s.descricao || "", ativo: s.ativo });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setMsg("");
    try {
      const url = editId ? `${AGENT_BASE}/admin/servicos/${editId}` : `${AGENT_BASE}/admin/servicos`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Erro ao salvar");
      setMsg(editId ? "✅ Serviço atualizado!" : "✅ Serviço criado!");
      setShowModal(false);
      await fetchServicos();
    } catch (e) { setMsg("❌ " + (e as Error).message); }
    finally { setSaving(false); setTimeout(() => setMsg(""), 3000); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Desativar este serviço?")) return;
    try {
      await fetch(`${AGENT_BASE}/admin/servicos/${id}`, { method: "DELETE", headers: headers() });
      setMsg("✅ Serviço desativado!"); await fetchServicos();
    } catch (e) { setMsg("❌ Erro ao desativar"); }
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return <div className="text-white/30 text-sm text-center py-8">Carregando serviços...</div>;

  return (
    <div>
      {msg && <div className="mb-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{msg}</div>}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Serviços ({servicos.filter(s => s.ativo).length} ativos)</h2>
        <button onClick={openNew} className="h-9 px-4 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium flex items-center gap-1.5 hover:bg-green-500/25 transition-all"><Plus className="h-4 w-4" />Novo Serviço</button>
      </div>
      <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] text-white/40 text-xs">
            <th className="px-4 py-3 text-left">Nome</th><th className="px-4 py-3 text-left">Categoria</th>
            <th className="px-4 py-3 text-right">Preço</th><th className="px-4 py-3 text-right">Duração</th>
            <th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Ações</th>
          </tr></thead>
          <tbody className="divide-y divide-white/[0.04]">
            {servicos.map(s => (
              <tr key={s.id} className={`hover:bg-white/[0.02] transition-colors ${!s.ativo ? "opacity-40" : ""}`}>
                <td className="px-4 py-3 text-white font-medium">{s.nome}</td>
                <td className="px-4 py-3 text-white/50">{s.categoria}</td>
                <td className="px-4 py-3 text-right text-green-400">R$ {s.preco.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-white/50">{s.duracao}min</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded-full ${s.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{s.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-all"><Pencil className="h-3.5 w-3.5" /></button>
                    {s.ativo && <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2a3a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">{editId ? "Editar Serviço" : "Novo Serviço"}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Categoria</label>
                <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40">
                  {CATEGORIAS.map(c => <option key={c} value={c} className="bg-[#1a2a3a]">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Nome</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Preço (R$)</label>
                  <input type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: parseFloat(e.target.value) || 0})} className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Duração (min)</label>
                  <input type="number" value={form.duracao} onChange={e => setForm({...form, duracao: parseInt(e.target.value) || 60})} className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-green-500/40 resize-none" />
              </div>
              <button onClick={handleSave} disabled={saving || !form.nome || !form.preco} className="w-full h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 transition-all">
                {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="h-4 w-4" />{editId ? "Salvar Alterações" : "Criar Serviço"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
