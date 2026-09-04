import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function ForbiddenSettings() {
  return <div className="grid min-h-[55vh] place-items-center"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600"><ShieldX className="size-6" /></span><h1 className="mt-4 text-xl font-bold text-slate-900">Settings access restricted</h1><p className="mt-2 text-sm leading-6 text-slate-500">Your relational permissions do not allow access to this administration section.</p><Link href="/admin/settings" className="mt-5 inline-block rounded-xl bg-[#102646] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#18355f]">Return to Settings</Link></div></div>;
}
