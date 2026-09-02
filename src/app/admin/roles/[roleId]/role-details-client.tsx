"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Shield, Lock, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PERMISSION_CATALOG } from "@/lib/auth/catalog";

type RoleDetailDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isSuperAdminRole: boolean;
  status: "ACTIVE" | "INACTIVE";
  assignedUserCount: number;
  permissions: string[];
  createdAt: string;
};

export function RoleDetailsClient({ role }: { role: RoleDetailDTO }) {
  const router = useRouter();
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(role.status);
  const [selectedCodes, setSelectedCodes] = useState<string[]>(role.permissions);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const categories = Array.from(new Set(PERMISSION_CATALOG.map((p) => p.category)));

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionCodes: selectedCodes,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role permissions.");

      setSuccess("Role permissions updated successfully!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete custom role '${role.name}'?`)) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete role.");

      router.push("/admin/roles");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeleting(false);
    }
  }

  function togglePermission(code: string) {
    if (role.isSuperAdminRole) return; // Super admin implicitly has all
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function selectCategory(category: string) {
    if (role.isSuperAdminRole) return;
    const catCodes = PERMISSION_CATALOG.filter((p) => p.category === category).map((p) => p.code);
    setSelectedCodes((prev) => Array.from(new Set([...prev, ...catCodes])));
  }

  function clearCategory(category: string) {
    if (role.isSuperAdminRole) return;
    const catCodes = new Set(PERMISSION_CATALOG.filter((p) => p.category === category).map((p) => p.code));
    setSelectedCodes((prev) => prev.filter((c) => !catCodes.has(c)));
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{role.name}</h1>
              {role.isSystem && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                  <Lock className="h-3 w-3" /> System
                </span>
              )}
              <StatusBadge tone={status === "ACTIVE" ? "success" : "warning"}>
                {status}
              </StatusBadge>
            </div>
            <span className="text-xs font-mono text-slate-400">slug: {role.slug}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!role.isSystem && !role.isSuperAdminRole && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting || role.assignedUserCount > 0}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete Role
            </Button>
          )}

          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Saving Changes..." : "Save Permission Matrix"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
          {success}
        </div>
      )}

      {/* Role Summary */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Role Overview</h2>
        <p className="text-xs text-slate-600">{role.description || "No description provided."}</p>
        <div className="flex items-center gap-4 text-xs text-slate-500 pt-2">
          <span>Assigned to <strong>{role.assignedUserCount}</strong> user(s)</span>
          <span>•</span>
          <span>Created on {new Date(role.createdAt).toLocaleDateString()}</span>
        </div>
      </Card>

      {/* Status Toggle */}
      {!role.isSuperAdminRole && (
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Role Status</div>
            <div className="text-[11px] text-slate-500">Deactivating a role immediately revokes permissions for all assigned users.</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="roleStatus"
                value="ACTIVE"
                checked={status === "ACTIVE"}
                onChange={() => setStatus("ACTIVE")}
                className="h-4 w-4 text-emerald-600"
              />
              Active
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="roleStatus"
                value="INACTIVE"
                checked={status === "INACTIVE"}
                onChange={() => setStatus("INACTIVE")}
                className="h-4 w-4 text-amber-600"
              />
              Inactive
            </label>
          </div>
        </Card>
      )}

      {/* Permission Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" /> Permission Matrix
          </h2>
          <span className="text-xs font-bold text-indigo-700">
            {role.isSuperAdminRole ? "All Permissions (Implicit Super Admin)" : `${selectedCodes.length} permission(s) assigned`}
          </span>
        </div>

        {role.isSuperAdminRole && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            Super Administrator implicitly possesses all system permissions by design. Explicit matrix customization is disabled.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {categories.map((category) => {
            const perms = PERMISSION_CATALOG.filter((p) => p.category === category);

            return (
              <Card key={category} className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900">{category}</h3>
                  {!role.isSuperAdminRole && (
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
                  )}
                </div>

                <div className="space-y-2">
                  {perms.map((p) => {
                    const isSelected = role.isSuperAdminRole || selectedCodes.includes(p.code);
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
                          disabled={role.isSuperAdminRole}
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
    </div>
  );
}
