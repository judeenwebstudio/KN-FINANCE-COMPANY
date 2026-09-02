import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeAccountTypePolicy } from "@/lib/serializers";
import { AccountTypesClient } from "./account-types-client";

export default async function AdminAccountTypesPage() {
  await requirePermission("accounts.view");

  const policies = await prisma.accountTypePolicy.findMany({
    orderBy: { code: "asc" },
    include: { branch: true },
  });

  const serialized = policies.map(serializeAccountTypePolicy);

  return <AccountTypesClient accountTypes={serialized} />;
}
