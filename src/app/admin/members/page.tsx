import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import {
  getUserEffectivePermissions,
  getUserAuthorizedBranchScope,
} from "@/lib/auth/authorize";
import { getMembersList } from "@/lib/members/member-service";
import { prisma } from "@/lib/prisma";
import { MembersClient } from "./members-client";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    branchId?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const user = await requireAdmin();
  const resolvedParams = await searchParams;

  // Relational RBAC permission check
  const permissions = await getUserEffectivePermissions(user.id);
  if (!permissions.has("members.view")) {
    redirect("/admin/dashboard");
  }

  const canCreate = permissions.has("members.create") || permissions.has("members.import");
  const canEdit = permissions.has("members.update");
  const canPurge = permissions.has("members.delete");

  // Branch Scope
  const branchScope = await getUserAuthorizedBranchScope(user.id);

  // Fetch authorized branches for filter dropdown
  const branchWhere = branchScope.global ? { status: "ACTIVE" as const } : { id: { in: branchScope.branchIds }, status: "ACTIVE" as const };
  const branches = await prisma.branch.findMany({
    where: branchWhere,
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const page = parseInt(resolvedParams.page || "1", 10);
  const pageSize = parseInt(resolvedParams.pageSize || "10", 10);

  const initialData = await getMembersList(user.id, {
    search: resolvedParams.search,
    branchId: resolvedParams.branchId,
    status: resolvedParams.status,
    page: isNaN(page) ? 1 : page,
    pageSize: isNaN(pageSize) ? 10 : pageSize,
  });

  return (
    <MembersClient
      initialData={initialData}
      branches={branches}
      canCreate={canCreate}
      canEdit={canEdit}
      canPurge={canPurge}
      userBranchScopeGlobal={branchScope.global}
    />
  );
}
