"use client";

import { useState, useEffect } from "react";
import { X, Edit, ShieldAlert, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMemberAction, getMemberForEditAction } from "./actions";
import { SafeMemberDetailDTO } from "@/lib/members/member-service";
import { UserStatus } from "@/generated/prisma/client";

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-[#275d4f] focus:outline-none";
const disabledInputClasses =
  "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 cursor-not-allowed";

export function EditMemberModal({
  memberId,
  onClose,
  onSuccess,
}: {
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [member, setMember] = useState<SafeMemberDetailDTO | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDetail() {
      setFetching(true);
      setError(null);
      const res = await getMemberForEditAction(memberId);
      if (!isMounted) return;
      setFetching(false);

      if (!res.success || !res.data) {
        setError(res.error || "Failed to load member detail.");
      } else {
        const m = res.data;
        setMember(m);
        setName(m.name);
        setPhone(m.phone);
        setAddress(m.address);
        setDateOfBirth(m.dateOfBirth || "");
        setIdentityNumber(m.identityNumber || "");
        setStatus(m.status);
      }
    }
    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [memberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setLoading(true);
    setError(null);

    const res = await updateMemberAction({
      memberId: member.id,
      name,
      phone,
      address,
      dateOfBirth: dateOfBirth ? dateOfBirth : null,
      identityNumber: identityNumber ? identityNumber : null,
      status,
    });

    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error || "Failed to update member.");
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#e8f2ef] text-[#275d4f]">
              <Edit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Edit Member Profile</h2>
              {member && (
                <p className="text-xs text-slate-500">
                  {member.memberNumber} • {member.email}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {fetching ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">
            Loading member profile securely...
          </div>
        ) : member ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Read-only)</label>
                <input
                  type="email"
                  disabled
                  value={member.email}
                  className={disabledInputClasses}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">National ID / Passport #</label>
                <input
                  type="text"
                  value={identityNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdentityNumber(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateOfBirth(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Branch (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={`${member.branchName} (${member.branchCode})`}
                  className={disabledInputClasses}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status *</label>
                <select
                  value={status}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as UserStatus)}
                  className={inputClasses}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800 border border-sky-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <p>
                Updating status controls member system login and portal access. It does not alter existing loan or account balances.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#275d4f] hover:bg-[#1e483d] text-white">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
