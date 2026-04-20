import { LayoutDashboard, Plug, MessageSquare, Settings, LifeBuoy, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const items = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Plug, label: "Connections", active: true },
  { icon: MessageSquare, label: "Messages", badge: 12 },
  { icon: Settings, label: "Settings" },
];

export const Sidebar = () => {
  const [active, setActive] = useState("Connections");

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-gradient-sidebar text-primary-foreground p-6 gap-2 shadow-elegant">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-11 w-11 rounded-2xl bg-gradient-glow flex items-center justify-center shadow-glow">
          <Bot className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-tight">ChatPilot</h1>
          <p className="text-xs text-primary-foreground/60">WhatsApp Automation</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/40 px-3 mb-2">Workspace</p>
        {items.map(({ icon: Icon, label, badge }) => {
          const isActive = active === label;
          return (
            <button
              key={label}
              onClick={() => setActive(label)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth group",
                isActive
                  ? "bg-primary-foreground/10 text-primary-foreground shadow-soft"
                  : "text-primary-foreground/70 hover:bg-primary-foreground/5 hover:text-primary-foreground"
              )}
            >
              <Icon className={cn("h-4.5 w-4.5 transition-smooth", isActive && "text-primary-glow")} size={18} />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className="text-[10px] font-semibold bg-primary-glow text-primary-deep px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-glow" />}
            </button>
          );
        })}
      </nav>

      {/* Pro card */}
      <div className="mt-auto bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary-glow" />
          <p className="text-sm font-semibold">Upgrade to Pro</p>
        </div>
        <p className="text-xs text-primary-foreground/60 mb-3">
          Unlock unlimited conversations and AI replies.
        </p>
        <button className="w-full text-xs font-semibold bg-gradient-glow text-primary-foreground py-2 rounded-lg shadow-glow hover:opacity-90 transition-smooth">
          See plans
        </button>
      </div>

      <button className="flex items-center gap-2 text-xs text-primary-foreground/60 hover:text-primary-foreground px-3 py-2 mt-2 transition-smooth">
        <LifeBuoy className="h-4 w-4" />
        Help & Support
      </button>
    </aside>
  );
};
