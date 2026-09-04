import { prisma } from "../src/lib/prisma";

async function main() {
  // Check if _prisma_migrations exists in any schema
  const schemas = await prisma.$queryRaw<Array<{schemaname: string, tablename: string}>>`
    SELECT schemaname, tablename FROM pg_tables 
    WHERE tablename LIKE '%prisma%' OR tablename LIKE '%migration%'
    ORDER BY schemaname, tablename;
  `;
  console.log("=== TABLES MATCHING 'prisma' OR 'migration' ===");
  console.log(schemas.length === 0 ? "NONE FOUND" : JSON.stringify(schemas, null, 2));

  // List all tables in public schema
  const allTables = await prisma.$queryRaw<Array<{tablename: string}>>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `;
  console.log("\n=== ALL PUBLIC SCHEMA TABLES ===");
  for (const t of allTables) {
    console.log(`- ${t.tablename}`);
  }

  // Financial aggregates
  const [accountBal, loanPrin, loanPaid, txAmt, repAmt] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT COALESCE(SUM("balance"), 0) as total FROM "Account"`,
    prisma.$queryRaw<any[]>`SELECT COALESCE(SUM("principalAmount"), 0) as total FROM "Loan"`,
    prisma.$queryRaw<any[]>`SELECT COALESCE(SUM("paidAmount"), 0) as total FROM "Loan"`,
    prisma.$queryRaw<any[]>`SELECT COALESCE(SUM("amount"), 0) as total FROM "Transaction"`,
    prisma.$queryRaw<any[]>`SELECT COALESCE(SUM("amount"), 0) as total FROM "LoanRepayment"`,
  ]);
  console.log("\n=== FINANCIAL AGGREGATES ===");
  console.log("Account Balances Sum:", accountBal[0].total.toString());
  console.log("Loan Principal Sum:", loanPrin[0].total.toString());
  console.log("Loan Paid Sum:", loanPaid[0].total.toString());
  console.log("Transaction Amount Sum:", txAmt[0].total.toString());
  console.log("Repayment Amount Sum:", repAmt[0].total.toString());

  // AccountTypePolicy NULL currency check
  const atpNull = await prisma.$queryRaw<any[]>`
    SELECT id, "accountType", currency FROM "AccountTypePolicy" WHERE currency IS NULL;
  `;
  console.log("\n=== AccountTypePolicy with NULL currency ===");
  console.log(atpNull.length === 0 ? "NONE" : JSON.stringify(atpNull, null, 2));
}

main().finally(() => prisma.$disconnect());
