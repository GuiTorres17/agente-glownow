import { CheckCircle2, AlertCircle, RefreshCw, LogIn } from "lucide-react";

const logs = [
  { icon: CheckCircle2, color: "text-success", title: "Device paired successfully", time: "Just now" },
  { icon: RefreshCw, color: "text-info", title: "QR code regenerated", time: "2 min ago" },
  { icon: LogIn, color: "text-primary", title: "Authentication initiated", time: "5 min ago" },
  { icon: AlertCircle, color: "text-warning", title: "Previous session expired", time: "1 hour ago" },
];

export const ActivityCard = () => (
  <div className="bg-card rounded-3xl shadow-card border border-border p-5 sm:p-6 animate-fade-in-up">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-display font-bold text-base text-foreground">Recent activity</h3>
        <p className="text-xs text-muted-foreground">Connection logs from the last hour</p>
      </div>
      <button className="text-xs font-semibold text-primary hover:text-primary-deep transition-smooth">
        View all
      </button>
    </div>
    <ul className="space-y-3">
      {logs.map(({ icon: Icon, color, title, time }, i) => (
        <li key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-smooth">
          <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
            <p className="text-[11px] text-muted-foreground">{time}</p>
          </div>
        </li>
      ))}
    </ul>
  </div>
);
