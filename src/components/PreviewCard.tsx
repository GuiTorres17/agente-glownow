import { CheckCircle2, Phone, RefreshCw, Bot } from "lucide-react";

type Status = "disconnected" | "connecting" | "connected";

export const PreviewCard = ({ status }: { status: Status }) => {
  const isConnected = status === "connected";
  return (
    <div className="bg-card rounded-3xl shadow-card border border-border overflow-hidden animate-fade-in-up">
      {/* Header strip */}
      <div className="bg-gradient-primary text-primary-foreground px-5 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary-foreground/15 flex items-center justify-center backdrop-blur">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            ChatPilot Bot
            {isConnected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-glow" />}
          </p>
          <p className="text-[11px] text-primary-foreground/70">Business Account</p>
        </div>
      </div>

      {/* Mini chat preview */}
      <div className="chat-pattern p-4 space-y-2 min-h-[140px]">
        <div className="max-w-[80%] bg-card rounded-2xl rounded-tl-sm px-3.5 py-2 shadow-soft text-xs text-foreground">
          Hi! How can I help you today? 👋
          <span className="block text-[9px] text-muted-foreground text-right mt-1">10:42 AM</span>
        </div>
        <div className="max-w-[75%] ml-auto bg-accent rounded-2xl rounded-tr-sm px-3.5 py-2 shadow-soft text-xs text-foreground">
          What are your opening hours?
          <span className="block text-[9px] text-muted-foreground text-right mt-1">10:42 AM ✓✓</span>
        </div>
        <div className="max-w-[80%] bg-card rounded-2xl rounded-tl-sm px-3.5 py-2 shadow-soft text-xs text-foreground">
          We're open 24/7 — I'm always here to help!
          <span className="block text-[9px] text-muted-foreground text-right mt-1">10:42 AM</span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-5 space-y-3">
        <Row label="Status" value={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-success" : status === "connecting" ? "bg-warning animate-pulse" : "bg-muted-foreground"}`} />
            <span className={isConnected ? "text-success" : "text-muted-foreground"}>
              {isConnected ? "Active" : status === "connecting" ? "Pairing" : "Offline"}
            </span>
          </span>
        } />
        <Row label="Phone" value={
          <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-primary" />
            {isConnected ? "+55 11 99876-5432" : "—"}
          </span>
        } />
        <Row label="Last sync" value={
          <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 text-primary" />
            {isConnected ? "Just now" : "Never"}
          </span>
        } />
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between border-b border-border last:border-0 pb-2.5 last:pb-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    {value}
  </div>
);
