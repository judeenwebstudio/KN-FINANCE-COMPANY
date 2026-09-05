"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RoleDTO = { id: string; name: string; slug: string; description: string | null };
type BranchDTO = { id: string; name: string; code: string };

export function NewUserClient({ availableRoles, availableBranches }: { availableRoles: RoleDTO[]; availableBranches: BranchDTO[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [hasGlobalBranchAccess, setHasGlobalBranchAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          roleIds: selectedRoleIds,
          branchIds: selectedBranchIds,
          hasGlobalBranchAccess,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");

      router.push(`/admin/users/${data.userId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating user");
    } finally {
      setSaving(false);
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  }

  function toggleBranch(branchId: string) {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  }

  const selectedRoleProfileIds = new Set(selectedRoleIds);
  const selectedBranchProfileIds = new Set(selectedBranchIds);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create New User</h1>
          <p className="text-xs text-slate-500">Register a new administrative or staff account.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Profile Information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.morgan@knfinance.demo"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Initial account password..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-600" /> Assign System & Custom Roles
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {availableRoles.map((role) => {
              const isSelected = selectedRoleProfileIds.has(role.id);
              return (
                <label
                  key={role.id}
                  htmlFor={`new-role-checkbox-${role.id}`}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors block ${
                    isSelected ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{role.name}</span>
                    <input
                      id={`new-role-checkbox-${role.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRole(role.id)}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  {role.description && <p className="text-[11px] text-slate-500 mt-1">{role.description}</p>}
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" /> Branch Authorization Scope
          </h2>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="globalScope"
              checked={hasGlobalBranchAccess}
              onChange={(e) => setHasGlobalBranchAccess(e.target.checked)}
              className="h-4 w-4 text-indigo-600 cursor-pointer"
            />
            <label htmlFor="globalScope" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Grant Global Access (All Branches)
            </label>
          </div>

          {!hasGlobalBranchAccess && (
            <div className="grid gap-2 sm:grid-cols-2 mt-3">
              {availableBranches.map((b) => {
                const isSelected = selectedBranchProfileIds.has(b.id);
                return (
                  <label
                    key={b.id}
                    htmlFor={`new-branch-checkbox-${b.id}`}
                    className={`cursor-pointer rounded-xl border p-2.5 transition-colors flex items-center justify-between ${
                      isSelected ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-800">{b.name} ({b.code})</span>
                    <input
                      id={`new-branch-checkbox-${b.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleBranch(b.id)}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Creating..." : "Create User"}
          </Button>
        </div>
      </form>
    </div>
  );
}
