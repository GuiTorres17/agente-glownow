import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Video, MoreVertical, Smile, Paperclip, Mic, Send, Check, CheckCheck, Camera, BadgeCheck, Copy, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

type Msg = {
  id: number;
  text: string;
  from: "me" | "them";
  time: string;
  status?: "sent" | "delivered" | "read";
};

const nowTimeStatic = () =>
  new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const initialMessages: Msg[] = [
  {
    id: 1,
    from: "them",
    text: "Oii, tudo bem? Seja bem-vinda à Lino Esmalteria! 💖\n\nEu sou a Lina, sua assistente virtual. Estou aqui pra te ajudar!\n\nPra eu te atender melhor, me conta: você já tem cadastro aqui com a gente?\n\n✅ Se sim, faça **login**\n🆕 Se é sua primeira vez, me fala **cadastrar**\n\nOu se quiser só dar uma olhadinha, posso te mostrar nossos **serviços** 💅\n\n_Ao continuar conversando comigo para realizar seu agendamento, você concorda com os nossos termos de uso de dados._",
    time: nowTimeStatic(),
  },
];

const Tick = ({ status }: { status?: Msg["status"] }) => {
  if (!status) return null;
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-foreground/40" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-foreground/40" />;
  return <CheckCheck className="h-3.5 w-3.5 text-info" />;
};

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:8000/chat";

/* ---------- PIX QR Code Block ---------- */
const PixBlock = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="my-3 p-4 rounded-xl bg-white border border-gray-200 shadow-sm flex flex-col items-center gap-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">PIX — Escaneie ou copie</p>
      <div className="bg-white p-2 rounded-lg">
        <QRCodeSVG value={code} size={180} level="M" />
      </div>
      <button
        onClick={handleCopy}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
          copied
            ? "bg-green-100 text-green-700 border border-green-300"
            : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 active:scale-[0.98]"
        )}
      >
        {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Código copiado!" : "Copiar código PIX"}
      </button>
    </div>
  );
};

/* ---------- Render text with bold + italic + PIX blocks ---------- */
const renderMessageContent = (text: string) => {
  // Split by {{PIX:...}} markers
  const pixParts = text.split(/(\{\{PIX:[^}]+\}\})/g);
  return pixParts.map((segment, si) => {
    const pixMatch = segment.match(/^\{\{PIX:(.+)\}\}$/);
    if (pixMatch) {
      return <PixBlock key={`pix-${si}`} code={pixMatch[1]} />;
    }
    // Render bold and italic markdown
    return segment.split(/(\*\*[^*]+\*\*|_[^_]+_)/).map((part, pi) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${si}-${pi}`} className="font-semibold">{part.slice(2, -2)}</strong>
        );
      }
      if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
        return (
          <em key={`${si}-${pi}`} className="text-[11px] text-gray-400 not-italic block mt-2">{part.slice(1, -1)}</em>
        );
      }
      return (
        <span key={`${si}-${pi}`}>{part}</span>
      );
    });
  });
};

const Index = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Frase secreta para acessar o painel admin
  const SECRET_PHRASE = "acesso administrativo lino esmalteria";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const send = async () => {
    const text = draft.trim();
    if (!text) return;

    // Verifica frase secreta do admin
    if (text.toLowerCase() === SECRET_PHRASE) {
      setDraft("");
      navigate("/admin/login");
      return;
    }

    const userMsg: Msg = { id: Date.now(), from: "me", text, time: nowTime(), status: "sent" };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setIsTyping(true);

    try {
      const res = await fetch(AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ message: text, user_id: "web-user" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply: string =
        data.reply ?? data.response ?? data.message ?? "(sem resposta)";
      setMessages((m) => [
        ...m.map((msg) => (msg.id === userMsg.id ? { ...msg, status: "read" as const } : msg)),
        { id: Date.now() + 1, from: "them", text: reply, time: nowTime() },
      ]);
    } catch (err) {
      console.error("Erro ao chamar agente:", err);
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          from: "them",
          text: "⚠️ Não consegui falar com o agente. Verifique se o servidor está rodando.",
          time: nowTime(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-0 sm:p-6">
      <div className="w-full max-w-md h-screen sm:h-[820px] sm:rounded-3xl overflow-hidden shadow-elegant bg-card flex flex-col">
        {/* Header */}
        <header className="bg-gradient-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-soft z-10">
          <button className="p-1 -ml-1 hover:bg-primary-foreground/10 rounded-full transition-smooth">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-full bg-primary-foreground/15 flex items-center justify-center backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-foreground/80" fill="currentColor">
              <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm flex items-center gap-1 leading-tight">
              Lina — Lino Esmalteria
              <BadgeCheck className="h-4 w-4 text-primary-glow" />
            </p>
            <p className="text-[11px] text-primary-foreground/70">Assistente Virtual • Online</p>
          </div>
          <button className="p-2 hover:bg-primary-foreground/10 rounded-full transition-smooth"><Video className="h-5 w-5" /></button>
          <button className="p-2 hover:bg-primary-foreground/10 rounded-full transition-smooth"><Phone className="h-4.5 w-4.5" size={18} /></button>
          <button className="p-2 hover:bg-primary-foreground/10 rounded-full transition-smooth"><MoreVertical className="h-5 w-5" /></button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 chat-pattern overflow-y-auto px-3 py-4 space-y-1.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev && prev.from === m.from;
            const isMe = m.from === "me";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex animate-fade-in-up",
                  isMe ? "justify-end" : "justify-start",
                  grouped ? "mt-0.5" : "mt-2"
                )}
              >
                <div
                  className={cn(
                    "relative max-w-[78%] px-3 py-2 text-[13.5px] leading-snug shadow-soft",
                    isMe
                      ? "bg-[hsl(142_70%_85%)] text-foreground rounded-2xl rounded-tr-sm"
                      : "bg-card text-foreground rounded-2xl rounded-tl-sm"
                  )}
                >
                  <div className="pr-12 whitespace-pre-wrap break-words">
                    {renderMessageContent(m.text)}
                  </div>
                  <span className="absolute bottom-1.5 right-2.5 flex items-center gap-0.5 text-[10px] text-foreground/50">
                    {m.time}
                    <Tick status={m.status} />
                  </span>
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="flex justify-start mt-2 animate-fade-in-up">
              <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-soft flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <footer className="bg-muted px-2 py-2 flex items-end gap-2">
          <div className="flex-1 flex items-center gap-1 bg-card rounded-full px-3 py-1.5 shadow-soft">
            <button className="p-1.5 text-muted-foreground hover:text-primary transition-smooth">
              <Smile className="h-5 w-5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Send message"
              className="flex-1 bg-transparent outline-none text-sm py-1.5 placeholder:text-muted-foreground"
            />
            <button className="p-1.5 text-muted-foreground hover:text-primary transition-smooth">
              <Paperclip className="h-5 w-5" />
            </button>
            <button className="p-1.5 text-muted-foreground hover:text-primary transition-smooth">
              <Camera className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={send}
            className="h-11 w-11 rounded-full bg-gradient-glow text-primary-foreground flex items-center justify-center shadow-glow hover:scale-105 active:scale-95 transition-smooth"
          >
            {draft.trim() ? <Send className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default Index;
