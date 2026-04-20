import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Phone, QrCode, RefreshCw, Smartphone, ShieldCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Status = "disconnected" | "connecting" | "connected";

const statusMap: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  disconnected: { label: "Disconnected", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
  connecting: { label: "Connecting…", dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  connected: { label: "Connected", dot: "bg-success", text: "text-success", bg: "bg-success/10" },
};

export const QrPanel = ({
  status,
  setStatus,
}: {
  status: Status;
  setStatus: (s: Status) => void;
}) => {
  const [token, setToken] = useState("chatpilot-wa-" + Math.random().toString(36).slice(2, 12));
  const [secondsLeft, setSecondsLeft] = useState(45);

  useEffect(() => {
    if (status !== "connecting") return;
    if (secondsLeft <= 0) {
      regenerate();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, status]);

  const regenerate = () => {
    setToken("chatpilot-wa-" + Math.random().toString(36).slice(2, 12));
    setSecondsLeft(45);
    setStatus("connecting");
    toast.success("New QR code generated", { description: "Scan it within 45 seconds." });
  };

  const s = statusMap[status];

  return (
    <section className="bg-card rounded-3xl shadow-card border border-border overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-6 sm:p-8 border-b border-border">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-accent px-3 py-1 rounded-full mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            End-to-end secured
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground leading-tight">
            Connect your chatbot to WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Link your WhatsApp number to ChatPilot to start automated conversations,
            quick replies and 24/7 customer support — all powered by AI.
          </p>
        </div>

        <div className={cn("flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap", s.bg, s.text)}>
          <span className={cn("h-2 w-2 rounded-full", s.dot, status === "connecting" && "animate-pulse")} />
          {s.label}
        </div>
      </div>

      {/* QR area */}
      <div className="grid md:grid-cols-[auto_1fr] gap-8 p-6 sm:p-8 bg-gradient-subtle">
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "relative p-5 bg-card rounded-2xl shadow-elegant border border-border",
            status === "connecting" && "pulse-ring"
          )}>
            <QRCodeSVG
              value={token}
              size={224}
              level="H"
              fgColor="hsl(158 64% 18%)"
              bgColor="transparent"
              imageSettings={{
                src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2325D366'><path d='M12 2a10 10 0 100 20 10 10 0 000-20zm5.2 14.3l-1.4 1.4a1 1 0 01-1.1.2c-2.4-1-4.6-3.2-5.6-5.6a1 1 0 01.2-1.1l1.4-1.4a1 1 0 000-1.4L8.9 6.9a1 1 0 00-1.4 0l-.9.9a3 3 0 00-.6 3.4c1.5 3.5 4.3 6.3 7.8 7.8a3 3 0 003.4-.6l.9-.9a1 1 0 000-1.4l-1.5-1.5a1 1 0 00-1.4 0z'/></svg>",
                height: 40,
                width: 40,
                excavate: true,
              }}
            />
            {status === "connected" && (
              <div className="absolute inset-0 bg-success/95 rounded-2xl flex flex-col items-center justify-center text-success-foreground">
                <ShieldCheck className="h-14 w-14 mb-2" strokeWidth={2} />
                <p className="font-semibold">Connected!</p>
              </div>
            )}
          </div>
          {status === "connecting" && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Refreshes in {secondsLeft}s
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground mb-3">How to connect</h3>
            <ol className="space-y-2.5">
              {[
                "Open WhatsApp on your phone",
                "Tap Menu (⋮) and choose Linked Devices",
                "Tap Link a Device and scan the QR code",
                "Wait until status turns green — you're live!",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center mt-0.5 flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={regenerate}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-glow text-primary-foreground font-semibold px-5 py-3 rounded-xl shadow-glow hover:opacity-95 hover:scale-[1.02] active:scale-[0.99] transition-smooth"
            >
              <QrCode className="h-4 w-4" />
              Generate QR Code
            </button>
            <button
              onClick={() => {
                setStatus("connected");
                toast.success("Connected via number", { description: "Verification code sent to +55 11 99876-5432" });
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-card border border-border text-foreground font-semibold px-5 py-3 rounded-xl hover:bg-accent hover:border-primary/30 transition-smooth"
            >
              <Phone className="h-4 w-4" />
              Connect via Number
            </button>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-card border border-border rounded-xl p-3">
            <Smartphone className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p>
              Open WhatsApp on your phone, go to <strong className="text-foreground">Linked Devices</strong>,
              and scan the QR code above. Keep your phone connected to the internet during the first sync.
            </p>
          </div>

          {status === "connected" && (
            <button
              onClick={() => toast.success("Test message sent!", { description: "A WhatsApp message was delivered to your number." })}
              className="self-start inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-deep transition-smooth"
            >
              <Send className="h-4 w-4" />
              Send a test message
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
