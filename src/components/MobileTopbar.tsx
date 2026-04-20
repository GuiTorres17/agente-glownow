import { Bot, Menu } from "lucide-react";

export const MobileTopbar = () => (
  <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-gradient-sidebar text-primary-foreground shadow-soft sticky top-0 z-20">
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-gradient-glow flex items-center justify-center">
        <Bot className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <div>
        <p className="font-display font-bold text-sm leading-tight">ChatPilot</p>
        <p className="text-[10px] text-primary-foreground/60">Connections</p>
      </div>
    </div>
    <button className="h-9 w-9 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
      <Menu className="h-4.5 w-4.5" size={18} />
    </button>
  </header>
);
