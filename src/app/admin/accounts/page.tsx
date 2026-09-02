import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeAccount, serializeAccountTypePolicy } from "@/lib/serializers";
import { AdminAccountsClient } from "./accounts-client";

export default async function AdminAccountsPage() {
  await requirePermission("accounts.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const accounts = await prisma.account.findMany({
    where: { branchId: { in: accessibleBranchIds } },
    include: {
      member: { include: { user: true } },
      branch: true,
      accountTypePolicy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const policies = await prisma.accountTypePolicy.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
  });

  const members = await prisma.memberProfile.findMany({
    where: { branchId: { in: accessibleBranchIds } },
    include: { user: true, branch: true },
    orderBy: { memberNumber: "asc" },
  });

  const serializedAccounts = accounts.map(serializeAccount);
  const serializedPolicies = policies.map(serializeAccountTypePolicy);
  const membersList = members.map((m) => ({
    id: m.id,
    memberNumber: m.memberNumber,
    name: m.user.name,
    branchId: m.branchId,
    branchName: m.branch.name,
  }));

  return (
    <AdminAccountsClient
      accounts={serializedAccounts}
      accountTypePolicies={serializedPolicies}
      membersList={membersList}
    />
  );
}
