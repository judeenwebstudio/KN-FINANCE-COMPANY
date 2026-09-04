import type { ReactNode } from "react";

export function SettingsStatusCard({ title, provider, status, detail, children }: { title: string; provider: string; status: "Configured" | "Operational" | "Not configured" | "Phase 8 pending" | "Not implemented"; detail: string; children?: ReactNode }) {
  const positive = status === "Configured" || status === "Operational";
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs font-medium text-slate-500">{provider}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${positive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{status}</span></div>
    <p className="mt-4 text-xs leading-5 text-slate-600">{detail}</p>{children}
  </section>;
}
