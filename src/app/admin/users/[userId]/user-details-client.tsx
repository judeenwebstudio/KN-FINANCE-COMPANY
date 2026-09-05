"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Shield, Building2, Key, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type RoleDTO = { id: string; name: string; slug: string; description: string | null };
type BranchDTO = { id: string; name: string; code: string };

type UserDetailDTO = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  hasGlobalBranchAccess: boolean;
  roles: RoleDTO[];
  branches: BranchDTO[];
  effectivePermissions: string[];
  createdAt: string;
};

export function UserDetailsClient({
  targetUser,
  allRoles,
  allBranches,
}: {
  targetUser: UserDetailDTO;
  allRoles: RoleDTO[];
  allBranches: BranchDTO[];
}) {
  const router = useRouter();
  const [name, setName] = useState(targetUser.name);
  const [email, setEmail] = useState(targetUser.email);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">(targetUser.status);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(targetUser.roles.map((r) => r.id));
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(targetUser.branches.map((b) => b.id));
  const [hasGlobalBranchAccess, setHasGlobalBranchAccess] = useState(targetUser.hasGlobalBranchAccess);

  // Synchronize component state with targetUser props when props change or after router.refresh()
  const [prevUserId, setPrevUserId] = useState(targetUser.id);
  const [prevRoles, setPrevRoles] = useState(targetUser.roles);
  if (targetUser.id !== prevUserId || targetUser.roles !== prevRoles) {
    setPrevUserId(targetUser.id);
    setPrevRoles(targetUser.roles);
    setName(targetUser.name);
    setEmail(targetUser.email);
    setStatus(targetUser.status);
    setSelectedRoleIds(targetUser.roles.map((r) => r.id));
    setSelectedBranchIds(targetUser.branches.map((b) => b.id));
    setHasGlobalBranchAccess(targetUser.hasGlobalBranchAccess);
  }

  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRoleProfileIds = new Set(selectedRoleIds);
  const selectedBranchProfileIds = new Set(selectedBranchIds);

  async function handleSendResetLink() {
    setSendingReset(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/reset-password`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset link.");

      if (data.delivered) {
        setSuccess(data.message || "Password reset instructions sent.");
      } else {
        setError(data.message || "Email provider is not configured.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset link request failed.");
    } finally {
      setSendingReset(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Valid email address is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          status,
          roleIds: Array.from(selectedRoleProfileIds),
          branchIds: Array.from(selectedBranchProfileIds),
          hasGlobalBranchAccess,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user.");

      setSuccess("User profile and configuration updated successfully!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{name || targetUser.name}</h1>
              <StatusBadge
                tone={status === "ACTIVE" ? "success" : status === "SUSPENDED" ? "danger" : "warning"}
              >
                {status}
              </StatusBadge>
            </div>
            <p className="text-xs text-slate-500">{email || targetUser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSendResetLink}
            disabled={sendingReset || saving}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {sendingReset ? "Sending Reset..." : "Send Password Reset Link"}
          </Button>
          <Button onClick={handleSave} disabled={saving || sendingReset} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Saving Changes..." : "Save Changes"}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Basic Profile, Roles & Branch Scope */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Profile / Basic Information */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-600" /> User Profile & Basic Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Avery Morgan"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@knfinance.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </Card>

          {/* Status Control */}
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Account Lifecycle Status</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="userStatus"
                  value="ACTIVE"
                  checked={status === "ACTIVE"}
                  onChange={() => setStatus("ACTIVE")}
                  className="h-4 w-4 text-emerald-600"
                />
                Active
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="userStatus"
                  value="INACTIVE"
                  checked={status === "INACTIVE"}
                  onChange={() => setStatus("INACTIVE")}
                  className="h-4 w-4 text-amber-600"
                />
                Inactive
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="userStatus"
                  value="SUSPENDED"
                  checked={status === "SUSPENDED"}
                  onChange={() => setStatus("SUSPENDED")}
                  className="h-4 w-4 text-rose-600"
                />
                Suspended
              </label>
            </div>
          </Card>

          {/* Assigned Roles */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" /> Assigned Roles
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {allRoles.map((role) => {
                const isSelected = selectedRoleProfileIds.has(role.id);
                return (
                  <label
                    key={role.id}
                    htmlFor={`role-checkbox-${role.id}`}
                    className={`cursor-pointer rounded-xl border p-3 transition-colors block ${
                      isSelected ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{role.name}</span>
                      <input
                        id={`role-checkbox-${role.id}`}
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

          {/* Branch Authorization Scope */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" /> Branch Authorization Scope
            </h2>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editGlobalScope"
                checked={hasGlobalBranchAccess}
                onChange={(e) => setHasGlobalBranchAccess(e.target.checked)}
                className="h-4 w-4 text-indigo-600 cursor-pointer"
              />
              <label htmlFor="editGlobalScope" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Global Branch Scope (Access All Branches)
              </label>
            </div>

            {!hasGlobalBranchAccess && (
              <div className="grid gap-2 sm:grid-cols-2 mt-3">
                {allBranches.map((b) => {
                  const isSelected = selectedBranchProfileIds.has(b.id);
                  return (
                    <label
                      key={b.id}
                      htmlFor={`branch-checkbox-${b.id}`}
                      className={`cursor-pointer rounded-xl border p-2.5 transition-colors flex items-center justify-between ${
                        isSelected ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold text-slate-800">{b.name} ({b.code})</span>
                      <input
                        id={`branch-checkbox-${b.id}`}
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
        </div>

        {/* Right Col: Effective Permissions Matrix View */}
        <div className="space-y-6">
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Key className="h-4 w-4 text-indigo-600" /> Effective Permissions ({targetUser.effectivePermissions.length})
            </h2>

            <p className="text-[11px] text-slate-500">
              Resolved union of permissions across all active assigned roles.
            </p>

            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
              {targetUser.effectivePermissions.length > 0 ? (
                targetUser.effectivePermissions.map((code) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-mono text-slate-700 border border-slate-200/60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{code}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No effective permissions.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
