import crypto from "node:crypto";

export function generateLoanNumber(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `LN-${year}${month}${day}-${randomSuffix}`;
}
