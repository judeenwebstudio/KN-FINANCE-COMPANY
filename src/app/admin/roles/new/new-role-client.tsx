"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PERMISSION_CATALOG } from "@/lib/auth/catalog";

export function NewRoleClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group catalog by category
  const categories = Array.from(new Set(PERMISSION_CATALOG.map((p) => p.category)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          permissionCodes: selectedCodes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create role.");

      router.push(`/admin/roles/${data.roleId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating role");
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(code: string) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function selectCategory(category: string) {
    const catCodes = PERMISSION_CATALOG.filter((p) => p.category === category).map((p) => p.code);
    setSelectedCodes((prev) => Array.from(new Set([...prev, ...catCodes])));
  }

  function clearCategory(category: string) {
    const catCodes = new Set(PERMISSION_CATALOG.filter((p) => p.category === category).map((p) => p.code));
    setSelectedCodes((prev) => prev.filter((c) => !catCodes.has(c)));
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Custom Role</h1>
          <p className="text-xs text-slate-500">Define a reusable authorization profile and map permissions.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Role Information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                placeholder="e.g. Senior Underwriter"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role Slug (Machine Code)</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. senior-underwriter"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe purpose and responsibilities of this role..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </Card>

        {/* Permission Matrix grouped by domain */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" /> Permission Matrix
            </h2>
            <span className="text-xs font-bold text-indigo-700">
              {selectedCodes.length} permission(s) selected
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {categories.map((category) => {
              const perms = PERMISSION_CATALOG.filter((p) => p.category === category);
              return (
                <Card key={category} className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-900">{category}</h3>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => selectCategory(category)}
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => clearCategory(category)}
                        className="font-semibold text-slate-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {perms.map((p) => {
                      const isSelected = selectedCodes.includes(p.code);
                      return (
                        <div
                          key={p.code}
                          onClick={() => togglePermission(p.code)}
                          className={`cursor-pointer rounded-lg border p-2.5 transition-colors flex items-start gap-2.5 ${
                            isSelected ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200/80 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 h-4 w-4 text-indigo-600 rounded"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">{p.code}</div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Creating..." : "Create Custom Role"}
          </Button>
        </div>
      </form>
    </div>
  );
}
