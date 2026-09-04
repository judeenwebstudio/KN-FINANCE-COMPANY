"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { changePasswordAction } from "./actions";

export function PasswordForm() {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setMessage(null);
    try { await changePasswordAction(values); setValues({ currentPassword: "", newPassword: "", confirmPassword: "" }); setMessage({ error: false, text: "Password changed successfully." }); }
    catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Unable to change password." }); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <div><h2 className="font-semibold text-slate-900">Change password</h2><p className="mt-1 text-xs text-slate-500">Your current password is required. The new password must contain at least 8 characters.</p></div>
    {message && <p role={message.error ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-xs ${message.error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message.text}</p>}
    {([['currentPassword','Current password'],['newPassword','New password'],['confirmPassword','Confirm new password']] as const).map(([key, label]) => <label key={key} className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span><span className="relative block"><input required minLength={key === "currentPassword" ? 1 : 8} autoComplete={key === "currentPassword" ? "current-password" : "new-password"} type={visible[key] ? "text" : "password"} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} className="h-10 w-full rounded-xl border border-slate-300 px-3 pr-10 text-sm outline-none focus:border-[#c59b46] focus:ring-2 focus:ring-[#c59b46]/20" /><button type="button" aria-label={`${visible[key] ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={Boolean(visible[key])} onClick={() => setVisible({ ...visible, [key]: !visible[key] })} className="absolute right-2 top-2 rounded p-1 text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#c59b46]">{visible[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>)}
    <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#102646] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18355f] disabled:opacity-50">{pending && <LoaderCircle className="size-4 animate-spin" />}Update password</button>
  </form>;
}
