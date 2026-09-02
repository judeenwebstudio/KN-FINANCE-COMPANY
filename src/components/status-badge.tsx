import { cn } from "@/lib/utils";

const styles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};
export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof styles }) { return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", styles[tone])}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{children}</span>; }
