"use client";

import { useState, useRef, useEffect } from "react";
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
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { GetMembersResult, SafeMemberListItemDTO } from "@/lib/members/member-service";
import { CreateMemberModal } from "./create-member-modal";
import { EditMemberModal } from "./edit-member-modal";
import { BulkImportModal } from "./bulk-import-modal";
import { purgeEmptyMemberAction } from "./actions";

type BranchDTO = { id: string; name: string; code: string };

function MemberActionMenu({
  member,
  canEdit,
  canPurge,
  userBranchScopeGlobal,
  onEdit,
  onPurge,
}: {
  member: SafeMemberListItemDTO;
  canEdit: boolean;
  canPurge: boolean;
  userBranchScopeGlobal: boolean;
  onEdit: () => void;
  onPurge: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 192; // 12rem (w-48)
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      let top = rect.bottom + 4;
      if (top + 180 > window.innerHeight && rect.top > 180) {
        top = rect.top - 180;
      }
      setMenuStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        zIndex: 9999,
      });
    }
  };

  const toggleMenu = () => {
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleScrollOrResize() {
      if (isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isPurgeEligible = canPurge && userBranchScopeGlobal && member.accountsCount === 0 && member.loansCount === 0;

  return (
    <div className="inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Actions for member ${member.name}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md shadow-xs hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#275d4f] focus:ring-offset-1 transition-colors cursor-pointer"
      >
        Actions
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          style={menuStyle}
          className="rounded-lg bg-white border border-slate-200 shadow-2xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100 text-left"
        >
          <div className="py-1">
            <Link
              href={`/admin/members/${member.id}`}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors w-full text-left"
            >
              <Eye className="h-3.5 w-3.5 text-[#275d4f] shrink-0" />
              View 360° Profile
            </Link>

            {canEdit && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onEdit();
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors w-full text-left cursor-pointer"
                >
                  <Edit className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  Edit Member
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onEdit();
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors w-full text-left cursor-pointer"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Change Status
                </button>
              </>
            )}
          </div>

          {isPurgeEligible && (
            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onPurge();
                }}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors w-full text-left cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                Purge Empty Member
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MembersClient({
  initialData,
  branches,
  canCreate,
  canEdit,
  canPurge,
  userBranchScopeGlobal,
}: {
  initialData: GetMembersResult;
  branches: BranchDTO[];
  canCreate: boolean;
  canEdit: boolean;
  canPurge: boolean;
  userBranchScopeGlobal: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [branchFilter, setBranchFilter] = useState(searchParams.get("branchId") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [purgingMember, setPurgingMember] = useState<{ id: string; name: string; memberNumber: string } | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

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

  const handlePurgeConfirm = async () => {
    if (!purgingMember) return;
    setPurging(true);
    setPurgeError(null);

    const res = await purgeEmptyMemberAction(purgingMember.id);
    setPurging(false);

    if (!res.success) {
      setPurgeError(res.error || "Failed to purge member.");
      return;
    }

    setPurgingMember(null);
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
          >
            <Link href="/admin/member-requests">
              <FileText className="h-3.5 w-3.5 text-amber-600" /> Member Requests
            </Link>
          </Button>
          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkImportOpen(true)}
                className="h-9 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" /> Bulk Import CSV
              </Button>
              <Button
                onClick={() => setCreateModalOpen(true)}
                size="sm"
                className="h-9 gap-1.5 bg-[#275d4f] hover:bg-[#1e483d] text-white text-xs shadow-xs"
              >
                <UserPlus className="h-3.5 w-3.5" /> Register New Member
              </Button>
            </>
          )}
        </div>
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
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
                          {m.photoUrl ? <img src={m.photoUrl} alt="" className="size-full object-cover" /> : m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div><Link
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
                      <div className="text-slate-400 text-[11px] mt-0.5">{m.phone}</div></div>
                      </div>
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
                      <MemberActionMenu
                        member={m}
                        canEdit={canEdit}
                        canPurge={canPurge}
                        userBranchScopeGlobal={userBranchScopeGlobal}
                        onEdit={() => setEditingMemberId(m.id)}
                        onPurge={() => {
                          setPurgeError(null);
                          setPurgingMember({ id: m.id, name: m.name, memberNumber: m.memberNumber });
                        }}
                      />
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

      {bulkImportOpen && (
        <BulkImportModal
          branches={branches}
          onClose={() => setBulkImportOpen(false)}
          onSuccess={() => {
            setBulkImportOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingMemberId && (
        <EditMemberModal
          memberId={editingMemberId}
          onClose={() => setEditingMemberId(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {purgingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="w-full max-w-md border-rose-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="text-base font-bold">Purge Empty Member Profile?</h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently purge member{" "}
              <strong className="text-slate-900">{purgingMember.name}</strong> (
              <span className="font-mono text-slate-800">{purgingMember.memberNumber}</span>)?
            </p>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 space-y-1">
              <p className="font-semibold">Financial Integrity Safety Guarantee:</p>
              <p>This action is permitted ONLY because the member has 0 accounts, 0 loans, and 0 financial history. This operation is recorded in the immutable audit log.</p>
            </div>

            {purgeError && (
              <div className="rounded-md bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {purgeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                disabled={purging}
                onClick={() => {
                  setPurgingMember(null);
                  setPurgeError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={purging}
                onClick={handlePurgeConfirm}
                className="bg-rose-700 hover:bg-rose-800 text-white text-xs"
              >
                {purging ? "Purging..." : "Confirm Purge"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
