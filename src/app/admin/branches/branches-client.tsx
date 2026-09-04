"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Edit3, MapPin, Plus, Search, X } from "lucide-react";
import { createBranchAction, toggleBranchStatusAction, updateBranchAction } from "../settings/branch-actions";
import { filterBranchDirectory, paginateBranchDirectory, type BranchDirectoryDTO, type BranchStatusFilter } from "@/lib/settings/branch-directory";

const PAGE_SIZE = 10;
const emptyForm = { name: "", code: "", email: "", phone: "", address: "", city: "", state: "", country: "India", currency: "INR" };

function ActionMenu({ branch, busy, onEdit, onToggle }: { branch: BranchDirectoryDTO; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 192;
      setStyle({ position: "fixed", top: Math.min(rect.bottom + 4, window.innerHeight - 112), left: Math.max(8, rect.right - width), width, zIndex: 9999 });
    }
    setOpen((value) => !value);
  }

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    }
    function closeOnViewportChange() { setOpen(false); }
    if (open) {
      document.addEventListener("mousedown", closeOutside);
      window.addEventListener("keydown", closeWithEscape);
      window.addEventListener("resize", closeOnViewportChange);
      window.addEventListener("scroll", closeOnViewportChange, true);
    }
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("keydown", closeWithEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  return <div className="inline-block">
    <button ref={buttonRef} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label={`Actions for ${branch.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#c59b46] focus:ring-offset-2">
      Actions <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div ref={menuRef} role="menu" style={style} className="rounded-xl border border-slate-200 bg-white py-1 shadow-2xl">
      <button role="menuitem" type="button" onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"><Edit3 className="size-4 text-indigo-600" />Edit Branch</button>
      {branch.code === "HQ-01" && branch.status === "ACTIVE" ? <span className="block px-3.5 py-2.5 text-xs text-slate-400">Head Office protected</span> : <button role="menuitem" type="button" disabled={busy} onClick={() => { setOpen(false); onToggle(); }} className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:opacity-50 ${branch.status === "ACTIVE" ? "text-rose-600" : "text-emerald-700"}`}>{busy ? "Processing…" : branch.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>}
    </div>}
  </div>;
}

export function BranchesClient({ initialBranches }: { initialBranches: BranchDirectoryDTO[] }) {
  const [branches, setBranches] = useState(initialBranches);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BranchStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BranchDirectoryDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const filtered = useMemo(() => filterBranchDirectory(branches, search, status), [branches, search, status]);
  const result = paginateBranchDirectory(filtered, page, PAGE_SIZE);

  function openCreate() { setEditing(null); setForm(emptyForm); setMessage(null); setModalOpen(true); }
  function openEdit(branch: BranchDirectoryDTO) {
    setEditing(branch);
    setForm({ name: branch.name, code: branch.code, email: branch.email, phone: branch.phone, address: branch.address, city: branch.city, state: branch.state, country: branch.country, currency: "INR" });
    setMessage(null); setModalOpen(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = editing ? await updateBranchAction(editing.id, form) : await createBranchAction(form);
      const branch = response.branch;
      if (editing) setBranches((items) => items.map((item) => item.id === branch.id ? { ...item, ...branch, currency: "INR" } : item));
      else setBranches((items) => [...items, { ...branch, currency: "INR" as const, userCount: 0, memberCount: 0, accountCount: 0, loanCount: 0 }].sort((a, b) => a.code.localeCompare(b.code)));
      setModalOpen(false); setMessage({ type: "success", text: `${branch.name} was ${editing ? "updated" : "created"} successfully.` });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save the branch." }); }
    finally { setSaving(false); }
  }
  async function toggleStatus(branch: BranchDirectoryDTO) {
    setBusyId(branch.id); setMessage(null);
    try {
      const response = await toggleBranchStatusAction(branch.id, branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      setBranches((items) => items.map((item) => item.id === branch.id ? { ...item, status: response.branch.status } : item));
      setMessage({ type: "success", text: `${branch.name} is now ${response.branch.status.toLowerCase()}.` });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to update branch status." }); }
    finally { setBusyId(null); }
  }
  function applyFilters(event: React.FormEvent) { event.preventDefault(); setSearch(searchDraft); setPage(1); }
  function clearFilters() { setSearchDraft(""); setSearch(""); setStatus("ALL"); setPage(1); }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a77b27]">Company network</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Branches</h1><p className="mt-1 text-sm text-slate-500">Manage company branch locations and operational access.</p></div>
      <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#102646] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#18355f] focus:outline-none focus:ring-2 focus:ring-[#c59b46] focus:ring-offset-2"><Plus className="size-4" />Add New Branch</button>
    </div>
    {message && <div role={message.type === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${message.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{message.text}</div>}
    <form onSubmit={applyFilters} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
      <label className="relative"><span className="sr-only">Search branch name, code, email, or phone</span><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search name, code or contact" className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-[#c59b46] focus:ring-2 focus:ring-[#c59b46]/20" /></label>
      <label><span className="sr-only">Status filter</span><select value={status} onChange={(e) => { setStatus(e.target.value as BranchStatusFilter); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#c59b46] focus:ring-2 focus:ring-[#c59b46]/20"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      <button type="submit" className="h-10 rounded-xl bg-[#102646] px-4 text-sm font-semibold text-white hover:bg-[#18355f]">Search</button>
      <button type="button" onClick={clearFilters} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear Filters</button>
    </form>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs" aria-label="Branch directory">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Branch Directory</h2><p className="text-xs text-slate-500">{filtered.length} branch{filtered.length === 1 ? "" : "es"} found</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">INR (₹) only</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Contact Email</th><th className="px-5 py-3">Contact Phone</th><th className="px-5 py-3">Currency</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{result.rows.map((branch) => <tr key={branch.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#102646]/8 text-[#102646]"><Building2 className="size-4" /></span><div><div className="font-semibold text-slate-900">{branch.name} {branch.code === "HQ-01" && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">HEAD OFFICE</span>}</div><div className="font-mono text-xs text-slate-500">{branch.code}</div><div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><MapPin className="size-3" />{branch.city}, {branch.state}</div></div></div></td><td className="px-5 py-4 text-slate-700">{branch.email}</td><td className="px-5 py-4 text-slate-700">{branch.phone}</td><td className="px-5 py-4"><span className="font-semibold text-slate-900">INR</span> <span className="text-slate-500">(₹)</span></td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${branch.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{branch.status}</span></td><td className="px-5 py-4 text-right"><ActionMenu branch={branch} busy={busyId === branch.id} onEdit={() => openEdit(branch)} onToggle={() => toggleStatus(branch)} /></td></tr>)}
      {result.rows.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">No branches match the selected filters.</td></tr>}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Page {result.page} of {result.totalPages}</p><div className="flex gap-2"><button type="button" disabled={result.page === 1} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><ChevronLeft className="size-3.5" />Previous</button><button type="button" disabled={result.page === result.totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Next<ChevronRight className="size-3.5" /></button></div></div>
    </section>
    {modalOpen && <div className="fixed inset-0 z-[10000] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="branch-form-title"><div className="my-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="branch-form-title" className="font-bold text-slate-900">{editing ? "Edit Branch" : "Add New Branch"}</h2><p className="text-xs text-slate-500">Operational branch details for KN Finance Company.</p></div><button type="button" onClick={() => setModalOpen(false)} aria-label="Close branch form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#c59b46]"><X className="size-4" /></button></div>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">{([['name','Branch Name'],['code','Branch Code'],['email','Contact Email'],['phone','Contact Phone'],['address','Address'],['city','City'],['state','State'],['country','Country']] as const).map(([key,label]) => <label key={key} className={key === "address" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label} *</span><input required type={key === "email" ? "email" : "text"} value={form[key]} disabled={key === "code" && Boolean(editing)} onChange={(e) => setForm({ ...form, [key]: key === "code" ? e.target.value.toUpperCase() : e.target.value })} className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#c59b46] focus:ring-2 focus:ring-[#c59b46]/20 disabled:bg-slate-100 disabled:text-slate-500" /></label>)}
      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Currency</span><input readOnly value="INR (₹)" aria-readonly="true" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700" /><span className="mt-1 block text-[11px] text-slate-500">KN Finance operates exclusively in Indian rupees.</span></label>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#102646] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#18355f] disabled:opacity-50">{saving ? "Saving…" : editing ? "Save Changes" : "Create Branch"}</button></div></form></div></div>}
  </div>;
}
