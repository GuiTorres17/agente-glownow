import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User, Sparkles } from "lucide-react";

const AGENT_BASE = (import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat").replace("/chat", "");

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${AGENT_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Credenciais inválidas");
      }

      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("admin_token", data.token);
        navigate("/admin");
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (err) {
      setError((err as Error).message || "Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1923] via-[#1a2a3a] to-[#0d2818]" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(34,197,94,0.15) 0%, transparent 50%),
                          radial-gradient(circle at 80% 30%, rgba(34,197,94,0.1) 0%, transparent 40%)`,
      }} />

      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-green-500/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-600/8 rounded-full blur-[120px] animate-pulse [animation-delay:1s]" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-xl bg-white/[0.06] border border-white/[0.1] rounded-3xl p-8 shadow-2xl">

          {/* Logo / Icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Painel Administrativo</h1>
            <p className="text-sm text-white/40 mt-1">Lino Esmalteria — Acesso Restrito</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-fade-in-up">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-green-400 transition-colors duration-200">
                <User className="h-4.5 w-4.5" size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Login"
                autoComplete="username"
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-white/25 text-sm outline-none focus:border-green-500/40 focus:bg-white/[0.08] focus:ring-1 focus:ring-green-500/20 transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-green-400 transition-colors duration-200">
                <Lock className="h-4.5 w-4.5" size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                className="w-full h-12 pl-11 pr-12 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-white/25 text-sm outline-none focus:border-green-500/40 focus:bg-white/[0.08] focus:ring-1 focus:ring-green-500/20 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Back link */}
          <button
            onClick={() => navigate("/")}
            className="w-full mt-5 text-center text-xs text-white/25 hover:text-white/50 transition-colors duration-200"
          >
            ← Voltar ao chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
