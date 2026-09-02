import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeLoanProduct } from "@/lib/serializers";
import { LoanProductClient } from "./loan-product-client";

export default async function AdminLoanProductsPage() {
  await requirePermission("loans.manage_products");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const products = await prisma.loanProduct.findMany({
    where: { OR: [{ branchId: null }, { branchId: { in: accessibleBranchIds } }] },
    include: { branch: true },
    orderBy: { createdAt: "desc" },
  });

  const branches = await prisma.branch.findMany({
    where: { id: { in: accessibleBranchIds }, status: "ACTIVE" },
    select: { id: true, name: true, code: true },
  });

  const serializedProducts = products.map(serializeLoanProduct);

  return (
    <LoanProductClient
      products={serializedProducts}
      branches={branches}
    />
  );
}
