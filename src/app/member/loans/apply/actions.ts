"use server";

import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { loanApplicationSchema } from "@/lib/validations";
import { calculateLoanPreview } from "@/lib/loans/calculator";
import { generateLoanNumber } from "@/lib/loans/number-generator";

export type ApplicationState = {
  success?: boolean;
  error?: string;
  loanId?: string;
};

export async function calculatePreviewAction(formData: FormData) {
  const memberUser = await requireMember();
  const productId = formData.get("productId") as string;
  const principalAmount = Number(formData.get("principalAmount"));
  const termMonths = Number(formData.get("termMonths"));

  if (!productId || !principalAmount || !termMonths) {
    return { error: "Missing required inputs for calculation" };
  }

  const product = await prisma.loanProduct.findUnique({
    where: { id: productId },
  });

  if (!product || product.status !== "ACTIVE") {
    return { error: "Selected loan product is not available" };
  }

  // Branch check
  if (product.branchId && product.branchId !== memberUser.branchId) {
    return { error: "This product is not available for your branch" };
  }

  if (principalAmount < Number(product.minimumAmount) || principalAmount > Number(product.maximumAmount)) {
    return {
      error: `Loan amount must be between ${product.minimumAmount} and ${product.maximumAmount} ${product.currency}`,
    };
  }

  if (termMonths < product.minimumTermMonths || termMonths > product.maximumTermMonths) {
    return {
      error: `Term must be between ${product.minimumTermMonths} and ${product.maximumTermMonths} months`,
    };
  }

  const preview = calculateLoanPreview({
    principalAmount,
    annualInterestRate: product.interestRate,
    termMonths,
    interestType: product.interestType,
    repaymentFrequency: product.repaymentFrequency,
    feeType: product.processingFeeType,
    feeValue: product.processingFeeValue,
  });

  return {
    success: true,
    preview: {
      productName: product.name,
      productCode: product.code,
      currency: product.currency,
      principalAmount: preview.principalAmount.toString(),
      interestRate: product.interestRate.toString(),
      interestType: product.interestType,
      termMonths,
      repaymentFrequency: product.repaymentFrequency,
      processingFee: preview.processingFee.toString(),
      totalInterest: preview.totalInterest.toString(),
      totalPayable: preview.totalPayable.toString(),
      estimatedInstallment: preview.estimatedInstallment.toString(),
      firstDueDate: preview.firstDueDate.toISOString(),
      maturityDate: preview.maturityDate.toISOString(),
      schedule: preview.schedule.map((s) => ({
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate.toISOString(),
        principalDue: s.principalDue.toString(),
        interestDue: s.interestDue.toString(),
        feeDue: s.feeDue.toString(),
        totalDue: s.totalDue.toString(),
      })),
    },
  };
}

export async function submitLoanApplicationAction(
  _: ApplicationState,
  formData: FormData
): Promise<ApplicationState> {
  const user = await requireMember();

  if (!user.memberProfile) {
    return { error: "Member profile not found" };
  }

  const parsed = loanApplicationSchema.safeParse({
    productId: formData.get("productId"),
    principalAmount: formData.get("principalAmount"),
    termMonths: formData.get("termMonths"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid application inputs" };
  }

  const product = await prisma.loanProduct.findUnique({
    where: { id: parsed.data.productId },
  });

  if (!product || product.status !== "ACTIVE") {
    return { error: "Selected loan product is inactive or invalid" };
  }

  if (product.branchId && product.branchId !== user.memberProfile.branchId) {
    return { error: "Selected loan product is not available in your branch" };
  }

  if (
    parsed.data.principalAmount < Number(product.minimumAmount) ||
    parsed.data.principalAmount > Number(product.maximumAmount)
  ) {
    return {
      error: `Amount must be between ${product.minimumAmount} and ${product.maximumAmount} ${product.currency}`,
    };
  }

  if (
    parsed.data.termMonths < product.minimumTermMonths ||
    parsed.data.termMonths > product.maximumTermMonths
  ) {
    return {
      error: `Term must be between ${product.minimumTermMonths} and ${product.maximumTermMonths} months`,
    };
  }

  // Authoritative calculations from backend calculation engine
  const preview = calculateLoanPreview({
    principalAmount: parsed.data.principalAmount,
    annualInterestRate: product.interestRate,
    termMonths: parsed.data.termMonths,
    interestType: product.interestType,
    repaymentFrequency: product.repaymentFrequency,
    feeType: product.processingFeeType,
    feeValue: product.processingFeeValue,
  });

  const loanNumber = generateLoanNumber();

  try {
    const loan = await prisma.loan.create({
      data: {
        loanNumber,
        productId: product.id,
        memberId: user.memberProfile.id,
        branchId: user.memberProfile.branchId,
        currency: product.currency,
        principalAmount: preview.principalAmount,
        interestRate: product.interestRate,
        interestType: product.interestType,
        termMonths: parsed.data.termMonths,
        repaymentFrequency: product.repaymentFrequency,
        processingFee: preview.processingFee,
        totalInterest: preview.totalInterest,
        totalPayable: preview.totalPayable,
        status: "PENDING",
        applicationDate: new Date(),
        createdById: user.id,
      },
    });

    return { success: true, loanId: loan.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit loan application" };
  }
}
