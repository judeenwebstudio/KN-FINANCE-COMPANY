import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeLoanProduct } from "@/lib/serializers";
import { ApplyClient } from "./apply-client";

export default async function MemberLoanApplyPage() {
  const memberUser = await requireMember();
  const branchId = memberUser.memberProfile?.branchId;

  const products = await prisma.loanProduct.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { branchId: null },
        ...(branchId ? [{ branchId }] : []),
      ],
    },
    include: { branch: true },
    orderBy: { name: "asc" },
  });

  const serializedProducts = products.map(serializeLoanProduct);

  return <ApplyClient products={serializedProducts} />;
}
