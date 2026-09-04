import { requireMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { LoanCalculatorClient } from "./loan-calculator-client";

export default async function MemberLoanCalculatorPage() {
  await requireMember();

  // Fetch active loan products to populate calculator options
  const products = await prisma.loanProduct.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
      minimumAmount: true,
      maximumAmount: true,
      interestRate: true,
      minimumTermMonths: true,
      maximumTermMonths: true,
      currency: true,
    },
  });

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    minAmount: p.minimumAmount.toFixed(2),
    maxAmount: p.maximumAmount.toFixed(2),
    interestRate: p.interestRate.toNumber(),
    minTermMonths: p.minimumTermMonths,
    maxTermMonths: p.maximumTermMonths,
    currency: p.currency,
  }));

  return <LoanCalculatorClient products={serializedProducts} />;
}
