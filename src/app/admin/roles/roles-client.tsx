"use client";

import Link from "next/link";
import { Plus, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type RoleDTO = {
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

export function RolesClient({ initialRoles }: { initialRoles: RoleDTO[] }) {
  const roles = initialRoles;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Role Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure system and custom roles, status, and domain-grouped permission matrices.
          </p>
        </div>
        <Link href="/admin/roles/new">
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Create Custom Role
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{role.name}</h2>
                    {role.isSystem && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                        <Lock className="h-3 w-3" /> System
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">slug: {role.slug}</span>
                </div>
                <StatusBadge tone={role.status === "ACTIVE" ? "success" : "warning"}>
                  {role.status}
                </StatusBadge>
              </div>

              {role.description && <p className="text-xs text-slate-600 mt-2">{role.description}</p>}

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Users className="h-3.5 w-3.5 text-slate-400" /> {role.assignedUserCount} assigned user(s)
                </span>
                <span className="font-semibold text-indigo-700">
                  {role.isSuperAdminRole ? "All Permissions (Implicit)" : `${role.permissions.length} Permission(s)`}
                </span>
              </div>
            </div>

            <div className="pt-3">
              <Link href={`/admin/roles/${role.id}`}>
                <Button variant="outline" className="w-full text-xs font-semibold">
                  Configure Permissions
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
