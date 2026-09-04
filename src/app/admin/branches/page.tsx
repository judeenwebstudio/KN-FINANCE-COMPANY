import { redirect } from "next/navigation";
import { getUserAuthorizedBranchScope, requirePermission } from "@/lib/auth/authorize";
import { getAllBranchesWithCounts } from "@/lib/settings/branch-service";
import { canAccessBranchDirectory, type BranchDirectoryDTO } from "@/lib/settings/branch-directory";
import { BranchesClient } from "./branches-client";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const actor = await requirePermission("settings.branch.manage");
  const scope = await getUserAuthorizedBranchScope(actor.id);
  if (!canAccessBranchDirectory(["settings.branch.manage"], scope.global)) redirect("/admin/dashboard");

  const records = await getAllBranchesWithCounts();
  const branches: BranchDirectoryDTO[] = records.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    email: branch.email,
    phone: branch.phone,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    country: branch.country,
    currency: "INR",
    status: branch.status,
    userCount: branch._count.users,
    memberCount: branch._count.members,
    accountCount: branch._count.accounts,
    loanCount: branch._count.loans,
  }));

  return <BranchesClient initialBranches={branches} />;
}
