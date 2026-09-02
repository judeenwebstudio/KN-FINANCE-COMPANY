import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds } from "./filters";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export type IncomeSummaryParams = {
  branchId?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
};

export type CurrencyIncomeSummary = {
  currency: string;
  interestCollections: string;
  interestReversals: string;
  netInterest: string;

  feeCollections: string;
  feeReversals: string;
  netFees: string;

  penaltyCollections: string;
  penaltyReversals: string;
  netPenalties: string;

  totalOperatingIncome: string;

  expenseDebits: string;
  expenseReversals: string;
  netOperatingExpenses: string;

  netOperationalIncome: string;
};

export async function getIncomeSummaryReport(params: IncomeSummaryParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  // 1. Fetch LoanRepayments posted in date range OR reversed in date range
  const repaymentWhere: Prisma.LoanRepaymentWhereInput = {
    loan: {
      branchId: { in: branchIds },
      ...(params.currency && params.currency !== "ALL" ? { currency: params.currency.toUpperCase() } : {}),
    },
  };

  const allRepayments = await prisma.loanRepayment.findMany({
    where: repaymentWhere,
    include: {
      loan: true,
      allocations: true,
    },
  });

  // 2. Fetch TreasuryTransaction expense debits and expense reversals in date range
  const ttxWhere: Prisma.TreasuryTransactionWhereInput = {
    treasuryAccount: { branchId: { in: branchIds } },
  };
  if (params.currency && params.currency !== "ALL") {
    ttxWhere.currency = params.currency.toUpperCase();
  }
  if (start || end) {
    ttxWhere.createdAt = {};
    if (start) ttxWhere.createdAt.gte = start;
    if (end) ttxWhere.createdAt.lt = end;
  }

  const treasuryTxs = await prisma.treasuryTransaction.findMany({
    where: ttxWhere,
    include: {
      expense: true,
      reversalOf: { include: { expense: true } },
    },
  });

  // 3. Fetch BankTransaction expense debits and expense reversals in date range
  const btxWhere: Prisma.BankTransactionWhereInput = {
    bankAccount: { branchId: { in: branchIds } },
  };
  if (params.currency && params.currency !== "ALL") {
    btxWhere.currency = params.currency.toUpperCase();
  }
  if (start || end) {
    btxWhere.createdAt = {};
    if (start) btxWhere.createdAt.gte = start;
    if (end) btxWhere.createdAt.lt = end;
  }

  const bankTxs = await prisma.bankTransaction.findMany({
    where: btxWhere,
    include: {
      expense: true,
      reversalOf: { include: { expense: true } },
    },
  });

  // Accumulate by ISO Currency Code
  const mapByCurrency: Record<
    string,
    {
      interestCollections: Prisma.Decimal;
      interestReversals: Prisma.Decimal;
      feeCollections: Prisma.Decimal;
      feeReversals: Prisma.Decimal;
      penaltyCollections: Prisma.Decimal;
      penaltyReversals: Prisma.Decimal;

      expenseDebits: Prisma.Decimal;
      expenseReversals: Prisma.Decimal;
    }
  > = {};

  function getCurrencyBucket(code: string) {
    const c = code.toUpperCase();
    if (!mapByCurrency[c]) {
      mapByCurrency[c] = {
        interestCollections: new Decimal(0),
        interestReversals: new Decimal(0),
        feeCollections: new Decimal(0),
        feeReversals: new Decimal(0),
        penaltyCollections: new Decimal(0),
        penaltyReversals: new Decimal(0),
        expenseDebits: new Decimal(0),
        expenseReversals: new Decimal(0),
      };
    }
    return mapByCurrency[c];
  }

  // Process Repayments
  for (const r of allRepayments) {
    const c = getCurrencyBucket(r.loan.currency);

    // Sum allocations
    let penalty = new Decimal(0);
    let fee = new Decimal(0);
    let interest = new Decimal(0);

    if (r.allocations && r.allocations.length > 0) {
      for (const alloc of r.allocations) {
        penalty = penalty.add(alloc.penaltyAmount);
        fee = fee.add(alloc.feeAmount);
        interest = interest.add(alloc.interestAmount);
      }
    } else {
      penalty = r.penaltyAmount;
      fee = r.feeAmount;
      interest = r.interestAmount;
    }

    // A. Original Collection event: paymentDate inside [start, end)
    const pDate = r.paymentDate;
    const inPostingPeriod = (!start || pDate >= start) && (!end || pDate < end);

    if (inPostingPeriod) {
      c.interestCollections = c.interestCollections.add(interest);
      c.feeCollections = c.feeCollections.add(fee);
      c.penaltyCollections = c.penaltyCollections.add(penalty);
    }

    // B. Reversal event: r.status === "REVERSED" and reversedAt inside [start, end)
    if (r.status === "REVERSED" && r.reversedAt) {
      const rDate = r.reversedAt;
      const inReversalPeriod = (!start || rDate >= start) && (!end || rDate < end);

      if (inReversalPeriod) {
        c.interestReversals = c.interestReversals.add(interest);
        c.feeReversals = c.feeReversals.add(fee);
        c.penaltyReversals = c.penaltyReversals.add(penalty);
      }
    }
  }

  // Process Treasury Expenses
  for (const t of treasuryTxs) {
    const c = getCurrencyBucket(t.currency);

    // DEBIT EXPENSE
    if (t.direction === "DEBIT" && (t.type === "EXPENSE" || t.expenseId)) {
      c.expenseDebits = c.expenseDebits.add(t.amount);
    }
    // CREDIT REVERSAL linked to EXPENSE
    else if (t.direction === "CREDIT" && t.type === "REVERSAL") {
      const isExpenseReversal = t.expenseId != null || (t.reversalOf && (t.reversalOf.type === "EXPENSE" || t.reversalOf.expenseId != null));
      if (isExpenseReversal) {
        c.expenseReversals = c.expenseReversals.add(t.amount);
      }
    }
  }

  // Process Bank Expenses
  for (const b of bankTxs) {
    const c = getCurrencyBucket(b.currency);

    // DEBIT EXPENSE
    if (b.direction === "DEBIT" && (b.type === "EXPENSE" || b.expenseId)) {
      c.expenseDebits = c.expenseDebits.add(b.amount);
    }
    // CREDIT REVERSAL linked to EXPENSE
    else if (b.direction === "CREDIT" && b.type === "REVERSAL") {
      const isExpenseReversal = b.expenseId != null || (b.reversalOf && (b.reversalOf.type === "EXPENSE" || b.reversalOf.expenseId != null));
      if (isExpenseReversal) {
        c.expenseReversals = c.expenseReversals.add(b.amount);
      }
    }
  }

  const currencySummaries: CurrencyIncomeSummary[] = Object.keys(mapByCurrency).map((code) => {
    const c = mapByCurrency[code];

    const netInterest = c.interestCollections.sub(c.interestReversals);
    const netFees = c.feeCollections.sub(c.feeReversals);
    const netPenalties = c.penaltyCollections.sub(c.penaltyReversals);

    const totalOperatingIncome = netInterest.add(netFees).add(netPenalties);
    const netOperatingExpenses = c.expenseDebits.sub(c.expenseReversals);
    const netOperationalIncome = totalOperatingIncome.sub(netOperatingExpenses);

    return {
      currency: code,
      interestCollections: c.interestCollections.toString(),
      interestReversals: c.interestReversals.toString(),
      netInterest: netInterest.toString(),

      feeCollections: c.feeCollections.toString(),
      feeReversals: c.feeReversals.toString(),
      netFees: netFees.toString(),

      penaltyCollections: c.penaltyCollections.toString(),
      penaltyReversals: c.penaltyReversals.toString(),
      netPenalties: netPenalties.toString(),

      totalOperatingIncome: totalOperatingIncome.toString(),

      expenseDebits: c.expenseDebits.toString(),
      expenseReversals: c.expenseReversals.toString(),
      netOperatingExpenses: netOperatingExpenses.toString(),

      netOperationalIncome: netOperationalIncome.toString(),
    };
  });

  return {
    filters: params,
    summaries: currencySummaries,
    metadata: {
      reportType: "Operational Income & Expense Summary (Non-Statutory)",
      postingDateBasis: "LoanRepayment.paymentDate",
      reversalDateBasis: "LoanRepayment.reversedAt & Ledger transactionDate",
      principalExclusion: "Principal repayments and disbursements are strictly excluded from income",
      transferExclusion: "Internal treasury/bank transfers and transfer reversals are strictly excluded",
      generatedAt: new Date().toISOString(),
    },
  };
}
