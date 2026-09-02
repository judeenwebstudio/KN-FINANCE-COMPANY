import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loanProductSchema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters"),
    code: z
      .string()
      .trim()
      .min(2, "Code must be at least 2 characters")
      .transform((val) => val.toUpperCase()),
    description: z.string().trim().optional().nullable(),
    currency: z.string().length(3, "Currency code must be 3 letters"),
    minimumAmount: z.coerce.number().positive("Minimum amount must be greater than 0"),
    maximumAmount: z.coerce.number().positive("Maximum amount must be greater than 0"),
    minimumTermMonths: z.coerce.number().int().positive("Minimum term must be at least 1 month"),
    maximumTermMonths: z.coerce.number().int().positive("Maximum term must be at least 1 month"),
    interestRate: z.coerce.number().min(0, "Interest rate cannot be negative"),
    interestType: z.enum(["FLAT", "DECLINING_BALANCE"]),
    repaymentFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
    processingFeeType: z.enum(["FIXED", "PERCENTAGE"]),
    processingFeeValue: z.coerce.number().min(0, "Fee value cannot be negative"),
    requiresApproval: z.boolean().default(true),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    branchId: z.string().optional().nullable(),
  })
  .refine((data) => data.minimumAmount <= data.maximumAmount, {
    message: "Minimum amount cannot exceed maximum amount",
    path: ["maximumAmount"],
  })
  .refine((data) => data.minimumTermMonths <= data.maximumTermMonths, {
    message: "Minimum term cannot exceed maximum term",
    path: ["maximumTermMonths"],
  });

export const loanApplicationSchema = z.object({
  productId: z.string().min(1, "Please select a loan product"),
  principalAmount: z.coerce.number().positive("Please enter a valid loan amount"),
  termMonths: z.coerce.number().int().positive("Please enter a valid loan term"),
});

export const loanRejectionSchema = z.object({
  loanId: z.string().min(1, "Loan ID required"),
  rejectionReason: z.string().trim().min(3, "Rejection reason is required"),
});

export const loanDisbursementSchema = z.object({
  loanId: z.string().min(1, "Loan ID required"),
  accountId: z.string().min(1, "Please select an account for disbursement"),
});
