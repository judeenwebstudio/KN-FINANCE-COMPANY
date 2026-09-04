"use client";

import Link from "next/link";
import { useState } from "react";
import { UserPlus, Search, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type SafeUserDTO = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  hasGlobalBranchAccess: boolean;
  roles: Array<{ id: string; name: string; slug: string }>;
  branches: Array<{ id: string; name: string; code: string }>;
  createdAt: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export function UsersClient({ initialUsers }: { initialUsers: SafeUserDTO[] }) {
  const users = initialUsers;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage administrative staff users, status lifecycle, roles, and branch authorization scopes.
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <UserPlus className="h-4 w-4" /> Add New User
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {/* User Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned Roles</th>
                <th className="px-4 py-3">Branch Scope</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={
                          u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "danger" : "warning"
                        }
                      >
                        {u.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length > 0 ? (
                          u.roles.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200/60"
                            >
                              <Shield className="h-3 w-3" /> {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No roles assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.hasGlobalBranchAccess ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                          <Building2 className="h-3 w-3" /> Global (All Branches)
                        </span>
                      ) : u.branches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.branches.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {b.name} ({b.code})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No branch assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {dateFormatter.format(new Date(u.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${u.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                          Manage
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
