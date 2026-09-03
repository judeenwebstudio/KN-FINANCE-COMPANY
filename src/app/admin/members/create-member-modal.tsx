"use client";

import { useState } from "react";
import { X, UserPlus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMemberAction } from "./actions";
import { SafeMemberListItemDTO } from "@/lib/members/member-service";

type BranchDTO = { id: string; name: string; code: string };

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-[#275d4f] focus:outline-none";

export function CreateMemberModal({
  branches,
  onClose,
  onSuccess,
}: {
  branches: BranchDTO[];
  onClose: () => void;
  onSuccess: (newMember: SafeMemberListItemDTO) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError("Initial password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await createMemberAction({
      name,
      email,
      password,
      phone,
      address,
      dateOfBirth: dateOfBirth ? dateOfBirth : null,
      identityNumber: identityNumber ? identityNumber : null,
      branchId,
    });

    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error || "Failed to create member.");
    } else {
      onSuccess(res.data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#e8f2ef] text-[#275d4f]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Register New Member</h2>
              <p className="text-xs text-slate-500">Create a member profile & user account</p>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              className={inputClasses}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="member@example.com"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
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
              placeholder="123 Main Street, Suite 400"
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
                placeholder="ID-987654321"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Branch *</label>
              <select
                required
                value={branchId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBranchId(e.target.value)}
                className={inputClasses}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters..."
                className={inputClasses}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#275d4f] hover:bg-[#1e483d] text-white">
              {loading ? "Registering..." : "Register Member"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
