"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { loanProductSchema } from "@/lib/validations";
import { serializeLoanProduct, type LoanProductDTO } from "@/lib/serializers";

export type ActionState = {
  success?: boolean;
  error?: string;
  data?: LoanProductDTO;
};

export async function createLoanProductAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requirePermission("loans.manage_products");
  const scope = await getUserAuthorizedBranchScope(admin.id);

  const rawData = {
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || null,
    currency: formData.get("currency"),
    minimumAmount: formData.get("minimumAmount"),
    maximumAmount: formData.get("maximumAmount"),
    minimumTermMonths: formData.get("minimumTermMonths"),
    maximumTermMonths: formData.get("maximumTermMonths"),
    interestRate: formData.get("interestRate"),
    interestType: formData.get("interestType"),
    repaymentFrequency: formData.get("repaymentFrequency"),
    processingFeeType: formData.get("processingFeeType"),
    processingFeeValue: formData.get("processingFeeValue"),
    requiresApproval: formData.get("requiresApproval") === "true",
    status: formData.get("status") || "ACTIVE",
    branchId: formData.get("branchId") || null,
  };

  const parsed = loanProductSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product parameters" };
  }

  // Branch check if admin is branch-scoped
  if (!parsed.data.branchId && !scope.global) return { error: "Global loan products require global branch scope" };
  if (parsed.data.branchId && !scope.branchIds.includes(parsed.data.branchId)) {
    return { error: "You cannot create products for another branch" };
  }

  // Code uniqueness check
  const existing = await prisma.loanProduct.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return { error: `Product code '${parsed.data.code}' is already in use` };
  }

  try {
    const product = await prisma.loanProduct.create({
      data: {
        ...parsed.data,
        branchId: parsed.data.branchId || null,
        createdById: admin.id,
      },
      include: { branch: true },
    });

    revalidatePath("/admin/loan-products");
    return { success: true, data: serializeLoanProduct(product) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create loan product" };
  }
}

export async function updateLoanProductAction(
  productId: string,
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requirePermission("loans.manage_products");
  const scope = await getUserAuthorizedBranchScope(admin.id);

  const rawData = {
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || null,
    currency: formData.get("currency"),
    minimumAmount: formData.get("minimumAmount"),
    maximumAmount: formData.get("maximumAmount"),
    minimumTermMonths: formData.get("minimumTermMonths"),
    maximumTermMonths: formData.get("maximumTermMonths"),
    interestRate: formData.get("interestRate"),
    interestType: formData.get("interestType"),
    repaymentFrequency: formData.get("repaymentFrequency"),
    processingFeeType: formData.get("processingFeeType"),
    processingFeeValue: formData.get("processingFeeValue"),
    requiresApproval: formData.get("requiresApproval") === "true",
    status: formData.get("status") || "ACTIVE",
    branchId: formData.get("branchId") || null,
  };

  const parsed = loanProductSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product parameters" };
  }

  const existingProduct = await prisma.loanProduct.findUnique({ where: { id: productId } });
  if (!existingProduct) {
    return { error: "Loan product not found" };
  }
  if (!scope.global && (!scope.branchIds.includes(existingProduct.branchId ?? "") || !parsed.data.branchId || !scope.branchIds.includes(parsed.data.branchId))) {
    return { error: "You cannot update global or out-of-scope loan products" };
  }

  // Code uniqueness check
  if (parsed.data.code !== existingProduct.code) {
    const codeCheck = await prisma.loanProduct.findUnique({ where: { code: parsed.data.code } });
    if (codeCheck) {
      return { error: `Product code '${parsed.data.code}' is already in use` };
    }
  }

  try {
    const updated = await prisma.loanProduct.update({
      where: { id: productId },
      data: {
        ...parsed.data,
        branchId: parsed.data.branchId || null,
        updatedById: admin.id,
      },
      include: { branch: true },
    });

    revalidatePath("/admin/loan-products");
    return { success: true, data: serializeLoanProduct(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update loan product" };
  }
}

export async function toggleLoanProductStatusAction(productId: string): Promise<ActionState> {
  const admin = await requirePermission("loans.manage_products");
  const scope = await getUserAuthorizedBranchScope(admin.id);

  const product = await prisma.loanProduct.findUnique({ where: { id: productId } });
  if (!product) return { error: "Product not found" };
  if (!scope.global && (!product.branchId || !scope.branchIds.includes(product.branchId))) return { error: "You cannot update this loan product" };

  const newStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  try {
    const updated = await prisma.loanProduct.update({
      where: { id: productId },
      data: {
        status: newStatus,
        updatedById: admin.id,
      },
      include: { branch: true },
    });

    revalidatePath("/admin/loan-products");
    return { success: true, data: serializeLoanProduct(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to toggle status" };
  }
}
