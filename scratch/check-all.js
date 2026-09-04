const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  try {
    const migrations = await p.$queryRawUnsafe(
      `SELECT migration_name, finished_at, applied_steps_count, rolled_back_at, logs FROM "_prisma_migrations" ORDER BY started_at ASC`
    );
    console.log("=== _prisma_migrations ===");
    for (const m of migrations) {
      console.log(JSON.stringify({
        name: m.migration_name,
        finished_at: m.finished_at,
        steps: Number(m.applied_steps_count),
        rolled_back: m.rolled_back_at,
        logs: m.logs
      }));
    }
  } catch (err) {
    console.log("Error querying _prisma_migrations:", err.message);
    try {
      const tables = await p.$queryRawUnsafe(
        `SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE '%prisma%' OR tablename LIKE '%migration%'`
      );
      console.log("Related tables found:", JSON.stringify(tables));
    } catch (e2) {
      console.log("Fallback also failed:", e2.message);
    }
  }

  try {
    const [accountBal, loanPrin, loanPaid, txAmt, repAmt] = await Promise.all([
      p.$queryRawUnsafe(`SELECT COALESCE(SUM("balance"), 0) as total FROM "Account"`),
      p.$queryRawUnsafe(`SELECT COALESCE(SUM("principalAmount"), 0) as total FROM "Loan"`),
      p.$queryRawUnsafe(`SELECT COALESCE(SUM("paidAmount"), 0) as total FROM "Loan"`),
      p.$queryRawUnsafe(`SELECT COALESCE(SUM("amount"), 0) as total FROM "Transaction"`),
      p.$queryRawUnsafe(`SELECT COALESCE(SUM("amount"), 0) as total FROM "LoanRepayment"`),
    ]);
    console.log("\n=== FINANCIAL AGGREGATES ===");
    console.log("Account Balances Sum:", accountBal[0].total.toString());
    console.log("Loan Principal Sum:", loanPrin[0].total.toString());
    console.log("Loan Paid Sum:", loanPaid[0].total.toString());
    console.log("Transaction Amount Sum:", txAmt[0].total.toString());
    console.log("Repayment Amount Sum:", repAmt[0].total.toString());
  } catch (err) {
    console.log("Financial aggregates error:", err.message);
  }
}

main().finally(() => p.$disconnect());
