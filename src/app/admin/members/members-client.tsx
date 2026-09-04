"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Search,
  UserPlus,
  Edit,
  Building2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Banknote,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { GetMembersResult } from "@/lib/members/member-service";
import { CreateMemberModal } from "./create-member-modal";
import { EditMemberModal } from "./edit-member-modal";

type BranchDTO = { id: string; name: string; code: string };

export function MembersClient({
  initialData,
  branches,
  canCreate,
  canEdit,
  userBranchScopeGlobal,
}: {
  initialData: GetMembersResult;
  branches: BranchDTO[];
  canCreate: boolean;
  canEdit: boolean;
  userBranchScopeGlobal: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [branchFilter, setBranchFilter] = useState(searchParams.get("branchId") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const updateFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    params.set("page", "1");
    router.push(`/admin/members?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search, branchId: branchFilter, status: statusFilter });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/members?${params.toString()}`);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    router.refresh();
  };

  const handleEditSuccess = () => {
    setEditingMemberId(null);
    router.refresh();
  };

  const { members, pagination } = initialData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Member Directory</h1>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <ShieldCheck className="mr-1 h-3 w-3" /> Branch-Scoped
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage registered credit union members, identity records, and branch assignments.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="gap-2 bg-[#275d4f] hover:bg-[#1e483d] text-white"
          >
            <UserPlus className="h-4 w-4" /> Register New Member
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-slate-50/70">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member #, name, email, phone, ID..."
              className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 shadow-xs focus:border-[#275d4f] focus:outline-none"
            />
          </div>

          {userBranchScopeGlobal && (
            <div className="w-44">
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  updateFilters({ search, branchId: e.target.value, status: statusFilter });
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-[#275d4f] focus:outline-none"
              >
                <option value="">All Authorized Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-36">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                updateFilters({ search, branchId: branchFilter, status: e.target.value });
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-[#275d4f] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          <Button type="submit" variant="outline" className="text-xs">
            Search
          </Button>

          {(search || branchFilter || statusFilter) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setBranchFilter("");
                setStatusFilter("");
                router.push("/admin/members");
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </Button>
          )}
        </form>
      </Card>

      {/* Directory Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Member Details</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Masked ID</th>
                <th className="px-4 py-3">Active Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No members found</p>
                    <p className="text-xs mt-1 text-slate-400">
                      Try adjusting your search query or filter selection.
                    </p>
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="font-bold text-[#275d4f] hover:underline"
                      >
                        {m.name}
                      </Link>
                      <div className="text-slate-500 font-mono text-[11px]">
                        <Link href={`/admin/members/${m.id}`} className="hover:underline">
                          {m.memberNumber}
                        </Link>{" "}
                        • {m.email}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{m.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{m.branchName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{m.branchCode}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {m.maskedIdentityNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-slate-600">
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <CreditCard className="h-3.5 w-3.5 text-[#275d4f]" />
                          <strong>{m.accountsCount}</strong> Accounts
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <Banknote className="h-3.5 w-3.5 text-amber-600" />
                          <strong>{m.loansCount}</strong> Loans
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={m.status === "ACTIVE" ? "success" : m.status === "SUSPENDED" ? "danger" : "neutral"}>
                        {m.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-slate-700 hover:text-slate-900"
                        >
                          <Link href={`/admin/members/${m.id}`}>
                            <Eye className="h-3.5 w-3.5 text-[#275d4f]" /> View 360°
                          </Link>
                        </Button>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingMemberId(m.id)}
                            className="h-8 gap-1 text-slate-700 hover:text-slate-900"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Showing <strong>{(pagination.page - 1) * pagination.pageSize + 1}</strong> to{" "}
              <strong>
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </strong>{" "}
              of <strong>{pagination.total}</strong> members
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
              </Button>
              <span className="font-semibold text-slate-700 px-1">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      {createModalOpen && (
        <CreateMemberModal
          branches={branches}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editingMemberId && (
        <EditMemberModal
          memberId={editingMemberId}
          onClose={() => setEditingMemberId(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
