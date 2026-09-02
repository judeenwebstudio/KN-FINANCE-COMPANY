import crypto from "crypto";
import { Prisma } from "@/generated/prisma/client";

export type ParsedStatementRow = {
  lineNumber: number;
  transactionDate: Date;
  description: string;
  reference: string | null;
  externalTransactionId: string | null;
  direction: "CREDIT" | "DEBIT";
  amount: Prisma.Decimal;
  currency: string;
  runningBalance: Prisma.Decimal | null;
  rawDescription: string;
};

export type ParsedStatementError = {
  lineNumber: number;
  field?: string;
  reason: string;
  rawValue?: string;
};

export type ParseStatementResult = {
  fileHash: string;
  rowCount: number;
  validRows: ParsedStatementRow[];
  errors: ParsedStatementError[];
  statementStartDate: Date | null;
  statementEndDate: Date | null;
};

/**
 * Calculates SHA-256 hex string for a given text or buffer content.
 */
export function calculateFileHash(content: string | Buffer): string {
  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Robust CSV parser that correctly handles quoted strings, escaped quotes,
 * multiline fields, CRLF/LF line endings, and UTF-8 BOM.
 */
export function parseCsvLines(rawText: string): string[][] {
  // Strip UTF-8 BOM if present
  const text = rawText.startsWith("\uFEFF") ? rawText.slice(1) : rawText;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("") inside quoted string
          currentField += '"';
          i++;
        } else {
          // End of quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header strings for flexible column matching.
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses raw CSV content into validated statement rows and error diagnostics.
 */
export function parseBankStatementCsv(rawContent: string, targetCurrency: string): ParseStatementResult {
  const fileHash = calculateFileHash(rawContent);
  const rawRows = parseCsvLines(rawContent);

  if (rawRows.length === 0) {
    return {
      fileHash,
      rowCount: 0,
      validRows: [],
      errors: [{ lineNumber: 0, reason: "CSV file is empty" }],
      statementStartDate: null,
      statementEndDate: null,
    };
  }

  const headerRow = rawRows[0];
  const normalizedHeaders = headerRow.map(normalizeHeader);

  // Column index maps
  const dateIdx = normalizedHeaders.findIndex((h) => h === "date" || h === "txdate" || h === "postingdate" || h.includes("date"));
  const descIdx = normalizedHeaders.findIndex((h) => h === "description" || h === "memo" || h === "detail" || h === "narrative" || h.includes("desc"));
  const refIdx = normalizedHeaders.findIndex((h) => h === "reference" || h === "ref" || h === "txid" || h === "check" || (h.includes("ref") && !h.includes("pref")));

  const amountIdx = normalizedHeaders.findIndex((h) => h === "amount" || h === "txamount" || h === "value");
  const debitIdx = normalizedHeaders.findIndex((h, idx) => idx !== descIdx && (h === "debit" || h === "dr" || h.startsWith("debit") || h.startsWith("dr") || h.includes("outflow")));
  const creditIdx = normalizedHeaders.findIndex((h, idx) => idx !== descIdx && (h === "credit" || h === "cr" || h.startsWith("credit") || h.startsWith("cr") || h.includes("inflow")));
  const directionIdx = normalizedHeaders.findIndex((h) => h === "direction" || h === "type" || h === "drcr");
  const balanceIdx = normalizedHeaders.findIndex((h) => h === "balance" || h === "runningbalance" || h.includes("balance"));

  if (dateIdx === -1) {
    return {
      fileHash,
      rowCount: rawRows.length - 1,
      validRows: [],
      errors: [{ lineNumber: 1, field: "Header", reason: "CSV missing required Date column header" }],
      statementStartDate: null,
      statementEndDate: null,
    };
  }

  const validRows: ParsedStatementRow[] = [];
  const errors: ParsedStatementError[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const lineNumber = i + 1; // 1-indexed row number including header
    const row = rawRows[i];

    if (!row || row.length === 0 || (row.length === 1 && !row[0])) {
      continue; // Skip completely empty rows
    }

    const rawDateStr = row[dateIdx] || "";
    const rawDesc = descIdx !== -1 ? row[descIdx] || "" : "";
    const rawRef = refIdx !== -1 ? row[refIdx] || null : null;
    const rawAmountStr = amountIdx !== -1 ? row[amountIdx] || "" : "";
    const rawDebitStr = debitIdx !== -1 ? row[debitIdx] || "" : "";
    const rawCreditStr = creditIdx !== -1 ? row[creditIdx] || "" : "";
    const rawDirectionStr = directionIdx !== -1 ? row[directionIdx] || "" : "";
    const rawBalanceStr = balanceIdx !== -1 ? row[balanceIdx] || "" : "";

    // 1. Validate Date
    const parsedDate = new Date(rawDateStr);
    if (isNaN(parsedDate.getTime())) {
      errors.push({
        lineNumber,
        field: "Date",
        reason: `Invalid date format '${rawDateStr}'`,
        rawValue: rawDateStr,
      });
      continue;
    }

    // 2. Validate Amount and Financial Direction
    let direction: "CREDIT" | "DEBIT" | null = null;
    let numAmount: number | null = null;

    if (rawDebitStr && rawDebitStr !== "0" && rawDebitStr !== "0.00") {
      const val = parseFloat(rawDebitStr.replace(/[^0-9.-]/g, ""));
      if (!isNaN(val) && val > 0) {
        direction = "DEBIT";
        numAmount = val;
      }
    }

    if (rawCreditStr && rawCreditStr !== "0" && rawCreditStr !== "0.00") {
      const val = parseFloat(rawCreditStr.replace(/[^0-9.-]/g, ""));
      if (!isNaN(val) && val > 0) {
        if (direction) {
          errors.push({
            lineNumber,
            field: "Amount",
            reason: "Row contains non-zero amounts in both Debit and Credit columns",
            rawValue: `Debit: ${rawDebitStr}, Credit: ${rawCreditStr}`,
          });
          continue;
        }
        direction = "CREDIT";
        numAmount = val;
      }
    }

    if (!direction && rawAmountStr) {
      const cleanAmt = rawAmountStr.replace(/[^0-9.-]/g, "");
      const val = parseFloat(cleanAmt);
      if (!isNaN(val) && val !== 0) {
        numAmount = Math.abs(val);
        if (rawDirectionStr) {
          const normDir = rawDirectionStr.toUpperCase();
          if (normDir.includes("CR") || normDir.includes("DEP") || normDir.includes("CREDIT")) {
            direction = "CREDIT";
          } else if (normDir.includes("DR") || normDir.includes("WITH") || normDir.includes("DEBIT")) {
            direction = "DEBIT";
          }
        }
        if (!direction) {
          direction = val < 0 ? "DEBIT" : "CREDIT";
        }
      }
    }

    if (!direction || numAmount === null || numAmount <= 0) {
      errors.push({
        lineNumber,
        field: "Amount/Direction",
        reason: "Could not resolve positive amount or clear financial direction (CREDIT/DEBIT)",
        rawValue: `Amount: ${rawAmountStr}, Debit: ${rawDebitStr}, Credit: ${rawCreditStr}`,
      });
      continue;
    }

    // 3. Parse Running Balance if present
    let runningBalanceDecimal: Prisma.Decimal | null = null;
    if (rawBalanceStr) {
      const val = parseFloat(rawBalanceStr.replace(/[^0-9.-]/g, ""));
      if (!isNaN(val)) {
        runningBalanceDecimal = new Prisma.Decimal(val);
      }
    }

    const decimalAmount = new Prisma.Decimal(numAmount.toFixed(4));
    const description = rawDesc || "Bank Statement Line";
    const reference = rawRef && rawRef.trim() ? rawRef.trim() : null;

    validRows.push({
      lineNumber,
      transactionDate: parsedDate,
      description,
      reference,
      externalTransactionId: reference,
      direction,
      amount: decimalAmount,
      currency: targetCurrency.toUpperCase(),
      runningBalance: runningBalanceDecimal,
      rawDescription: row.join(" | "),
    });
  }

  // Calculate start/end date range from valid rows
  let statementStartDate: Date | null = null;
  let statementEndDate: Date | null = null;

  if (validRows.length > 0) {
    const dates = validRows.map((r) => r.transactionDate.getTime());
    statementStartDate = new Date(Math.min(...dates));
    statementEndDate = new Date(Math.max(...dates));
  }

  return {
    fileHash,
    rowCount: rawRows.length - 1,
    validRows,
    errors,
    statementStartDate,
    statementEndDate,
  };
}
