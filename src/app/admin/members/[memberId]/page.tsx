import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getUserEffectivePermissions } from "@/lib/auth/authorize";
import { getMember360Profile, Member360ProfileDTO } from "@/lib/members/member-service";
import { Member360Client } from "./member-360-client";

export default async function Member360Page({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ txPage?: string }>;
}) {
  const user = await requireAdmin();
  const { memberId } = await params;
  const { txPage } = await searchParams;

  const permissions = await getUserEffectivePermissions(user.id);
  if (!permissions.has("members.view")) {
    redirect("/admin/dashboard");
  }

  const parsedTxPage = parseInt(txPage || "1", 10);

  let profile: Member360ProfileDTO | null = null;
  let errorMessage: string | null = null;

  try {
    profile = await getMember360Profile(user.id, memberId, {
      txPage: isNaN(parsedTxPage) ? 1 : parsedTxPage,
      txPageSize: 10,
    });
  } catch (err: unknown) {
    errorMessage = (err as Error)?.message || "Failed to load member profile.";
  }

  if (errorMessage || !profile) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 shadow-xs">
          <h2 className="text-base font-bold">Access Denied or Member Not Found</h2>
          <p className="mt-1 text-xs text-rose-600">{errorMessage || "Member profile not found."}</p>
          <div className="mt-4">
            <Link
              href="/admin/members"
              className="inline-flex items-center rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-800"
            >
              Back to Member Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Member360Client profile={profile} canEdit={permissions.has("members.edit") || permissions.has("members.manage")} />;
}
