import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { getPortfolioQualityReport } from "@/lib/reports/portfolio-quality-reports";
import { PortfolioQualityReportClient } from "./portfolio-quality-report-client";

export default async function AdminPortfolioQualityPage() {
  await requirePermission("reports.portfolio_quality");
  const branchIds = await getAccessibleBranchIds();

  const [initialReport, branches, products] = await Promise.all([
    getPortfolioQualityReport(),
    prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, code: true },
    }),
    prisma.loanProduct.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <PortfolioQualityReportClient
      initialReport={initialReport}
      branches={branches}
      products={products}
    />
  );
}
