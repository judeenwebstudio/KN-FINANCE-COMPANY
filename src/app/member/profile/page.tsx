import { notFound } from "next/navigation";
import { requireMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { maskIdentityNumber } from "@/lib/members/member-service";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { User, Mail, Phone, MapPin, Calendar, Building2, ShieldCheck, Lock } from "lucide-react";

export default async function MemberProfilePage() {
  const user = await requireMember();
  const profile = user.memberProfile;

  if (!profile) {
    notFound();
  }

  const branch = profile.branchId
    ? await prisma.branch.findUnique({
        where: { id: profile.branchId },
        select: { name: true, code: true },
      })
    : null;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <User className="size-6 text-indigo-600" /> My Profile
        </h1>
        <p className="text-sm text-slate-500">
          View your authenticated member profile details and credit union branch registration.
        </p>
      </div>

      <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 font-serif font-bold text-xl border border-indigo-100">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  {profile.memberNumber}
                </span>
                <StatusBadge tone={user.status === "ACTIVE" ? "success" : "danger"}>
                  {user.status}
                </StatusBadge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact & Identity</h3>

            <div className="flex items-start gap-3">
              <Mail className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Email Address</span>
                <span className="text-sm font-semibold text-slate-800">{user.email}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Phone Number</span>
                <span className="text-sm font-semibold text-slate-800">{profile.phone}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Residential Address</span>
                <span className="text-sm font-semibold text-slate-800">{profile.address}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Masked Identity / National ID</span>
                <span className="text-sm font-mono font-semibold text-slate-800">
                  {maskIdentityNumber(profile.identityNumber) || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Branch & Registration</h3>

            <div className="flex items-start gap-3">
              <Building2 className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Assigned Branch</span>
                <span className="text-sm font-semibold text-slate-800">
                  {branch?.name ? `${branch.name} (${branch.code})` : "Primary HQ"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Date of Birth</span>
                <span className="text-sm font-semibold text-slate-800">{formatDate(profile.dateOfBirth)}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Registration Date</span>
                <span className="text-sm font-semibold text-slate-800">{formatDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Lock className="size-4 text-slate-400 shrink-0" />
            <span>To update protected fields (Name, Identity Number, or Branch), please contact your branch administrator.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
