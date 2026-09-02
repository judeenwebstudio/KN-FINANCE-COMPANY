import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "indigo" | "emerald" | "amber" | "violet" | "rose" | "cyan";
const tones: Record<StatTone, { card: string; icon: string; accent: string }> = {
  indigo: { card: "from-indigo-50/80", icon: "bg-indigo-100 text-indigo-600", accent: "bg-indigo-500" },
  emerald: { card: "from-emerald-50/80", icon: "bg-emerald-100 text-emerald-600", accent: "bg-emerald-500" },
  amber: { card: "from-amber-50/80", icon: "bg-amber-100 text-amber-600", accent: "bg-amber-500" },
  violet: { card: "from-violet-50/80", icon: "bg-violet-100 text-violet-600", accent: "bg-violet-500" },
  rose: { card: "from-rose-50/80", icon: "bg-rose-100 text-rose-600", accent: "bg-rose-500" },
  cyan: { card: "from-cyan-50/80", icon: "bg-cyan-100 text-cyan-600", accent: "bg-cyan-500" },
};

export function StatCard({ label, value, hint, icon: Icon, tone = "indigo" }: { label: string; value: string; hint: string; icon: LucideIcon; tone?: StatTone }) {
  const style = tones[tone];
  return <Card className={cn("group relative min-h-36 overflow-hidden bg-gradient-to-br to-white p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,.08)]", style.card)}>
    <span className={cn("absolute inset-x-0 top-0 h-0.5", style.accent)} />
    <div className="flex h-full items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p></div><span className={cn("grid size-11 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105", style.icon)}><Icon className="size-5" aria-hidden="true" /></span></div>
  </Card>;
}
