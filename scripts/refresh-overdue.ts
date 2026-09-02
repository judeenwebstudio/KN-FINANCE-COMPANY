import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { refreshLoanOverdueStateInTx } from "../src/lib/loans/overdue";

async function runOverdueRefresh() {
  const args = process.argv.slice(2);
  let effectiveDate = new Date();

  const dateArg = args.find((a) => a.startsWith("--date="));
  if (dateArg) {
    const val = dateArg.split("=")[1];
    if (val) {
      effectiveDate = new Date(val);
    }
  }

  console.log("==================================================");
  console.log(`Starting Overdue Refresh Job (Effective Date: ${effectiveDate.toISOString().slice(0, 10)})...`);
  console.log("==================================================");

  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, loanNumber: true },
  });

  console.log(`Found ${activeLoans.length} active loan facilities for evaluation.`);

  let processedCount = 0;

  for (const loan of activeLoans) {
    await prisma.$transaction(async (tx) => {
      const res = await refreshLoanOverdueStateInTx(tx, loan.id, effectiveDate);
      if (res.refreshed) processedCount++;
    });
  }

  // Count total active penalty assessments for report
  const assessmentCount = await prisma.loanPenaltyAssessment.count({
    where: { status: "ACTIVE" },
  });

  console.log("--------------------------------------------------");
  console.log(`✓ Evaluated Active Loans: ${processedCount}/${activeLoans.length}`);
  console.log(`✓ Total Active Penalty Assessments in Ledger: ${assessmentCount}`);
  console.log("==================================================");
  console.log("Overdue Refresh Completed Successfully!");
  console.log("==================================================");
}

runOverdueRefresh()
  .catch((e) => {
    console.error("Overdue Refresh Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
