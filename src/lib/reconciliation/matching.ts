import { Prisma } from "@/generated/prisma/client";

export type MatchingCandidate = {
  bankTransactionId: string;
  bankTransactionNumber: string;
  transactionDate: Date;
  amount: Prisma.Decimal;
  direction: "CREDIT" | "DEBIT";
  currency: string;
  reference: string | null;
  description: string | null;
  reconciliationStatus: string;
};

export type MatchConfidence = "EXACT" | "STRONG" | "POSSIBLE";

export type AutoMatchResult = {
  statementLineId: string;
  candidateId: string;
  confidence: MatchConfidence;
  reason: string;
};

/**
 * Safely normalizes reference strings for comparison.
 * Trims whitespace, converts to uppercase, and strips harmless punctuation.
 * Does NOT aggressively alter alphanumerics.
 */
export function normalizeReference(ref: string | null | undefined): string | null {
  if (!ref || !ref.trim()) return null;
  const clean = ref.trim().toUpperCase().replace(/[\s\-_]/g, "");
  return clean.length >= 3 ? clean : null;
}

/**
 * Checks if two dates fall within a given number of calendar days of each other.
 */
export function isWithinCalendarDays(dateA: Date, dateB: Date, days: number): boolean {
  const msDiff = Math.abs(dateA.getTime() - dateB.getTime());
  const maxMs = days * 24 * 60 * 60 * 1000;
  return msDiff <= maxMs;
}

/**
 * Evaluates candidate BankTransactions against an unmatched BankStatementLine.
 * Returns match confidence classification if compatible.
 */
export function evaluateCandidateMatch(
  line: {
    transactionDate: Date;
    amount: Prisma.Decimal;
    direction: "CREDIT" | "DEBIT";
    currency: string;
    reference: string | null;
  },
  candidate: MatchingCandidate
): { confidence: MatchConfidence; reason: string } | null {
  // 1. Strict equality check on direction, currency, and exact Decimal amount
  if (line.direction !== candidate.direction) return null;
  if (line.currency.toUpperCase() !== candidate.currency.toUpperCase()) return null;
  if (!line.amount.equals(candidate.amount)) return null;

  // 2. Date tolerance check (calendar-day basis, ±2 days)
  if (!isWithinCalendarDays(line.transactionDate, candidate.transactionDate, 2)) {
    return null;
  }

  const lineRef = normalizeReference(line.reference);
  const candRef = normalizeReference(candidate.reference);
  const refMatches = lineRef !== null && candRef !== null && (lineRef.includes(candRef) || candRef.includes(lineRef));

  const isSameDate = line.transactionDate.toISOString().slice(0, 10) === candidate.transactionDate.toISOString().slice(0, 10);

  if (isSameDate && refMatches) {
    return { confidence: "EXACT", reason: "Exact amount, currency, direction, date, and reference match" };
  }

  if (refMatches) {
    return { confidence: "STRONG", reason: "Exact amount, currency, direction, reference match within ±2 calendar days" };
  }

  if (isSameDate) {
    return { confidence: "STRONG", reason: "Exact amount, currency, direction, and exact date match" };
  }

  return { confidence: "POSSIBLE", reason: "Exact amount, currency, direction match within ±2 calendar days" };
}

/**
 * Runs conservative auto-matching logic over a set of unmatched statement lines and candidate transactions.
 * Returns only safe, unambiguous EXACT or STRONG matches.
 */
export function findAutoMatches(
  statementLines: Array<{
    id: string;
    transactionDate: Date;
    amount: Prisma.Decimal;
    direction: "CREDIT" | "DEBIT";
    currency: string;
    reference: string | null;
    status: string;
  }>,
  candidateTransactions: MatchingCandidate[]
): AutoMatchResult[] {
  const autoMatches: AutoMatchResult[] = [];
  const matchedTxIds = new Set<string>();

  for (const line of statementLines) {
    if (line.status !== "UNMATCHED") continue;

    // Evaluate all potential candidates for this line
    const evaluations: Array<{ candidate: MatchingCandidate; confidence: MatchConfidence; reason: string }> = [];

    for (const candidate of candidateTransactions) {
      if (matchedTxIds.has(candidate.bankTransactionId)) continue;
      if (candidate.reconciliationStatus !== "UNRECONCILED") continue;

      const evalResult = evaluateCandidateMatch(line, candidate);
      if (evalResult) {
        evaluations.push({ candidate, ...evalResult });
      }
    }

    if (evaluations.length === 0) continue;

    // Sort by confidence: EXACT > STRONG > POSSIBLE
    const exacts = evaluations.filter((e) => e.confidence === "EXACT");
    const strongs = evaluations.filter((e) => e.confidence === "STRONG");

    // Disambiguation rule: Only auto-confirm if there is EXACTLY ONE candidate at the highest acceptable confidence level.
    let selected: { candidate: MatchingCandidate; confidence: MatchConfidence; reason: string } | null = null;

    if (exacts.length === 1) {
      selected = exacts[0];
    } else if (exacts.length === 0 && strongs.length === 1) {
      selected = strongs[0];
    }

    if (selected) {
      autoMatches.push({
        statementLineId: line.id,
        candidateId: selected.candidate.bankTransactionId,
        confidence: selected.confidence,
        reason: selected.reason,
      });
      matchedTxIds.add(selected.candidate.bankTransactionId);
    }
  }

  return autoMatches;
}
