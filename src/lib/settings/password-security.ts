import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";

export const MINIMUM_PASSWORD_LENGTH = 8;
export const BCRYPT_COST = 12;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(MINIMUM_PASSWORD_LENGTH, `New password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "New password and confirmation do not match.",
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export class PasswordChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordChangeError";
  }
}

export async function changeOwnPassword(userId: string, input: ChangePasswordInput) {
  const validated = changePasswordSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new PasswordChangeError("Active account not found.");
  if (!(await compare(validated.currentPassword, user.passwordHash))) throw new PasswordChangeError("Current password is incorrect.");
  if (await compare(validated.newPassword, user.passwordHash)) throw new PasswordChangeError("New password must differ from the current password.");

  const passwordHash = await hash(validated.newPassword, BCRYPT_COST);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logAuditEvent({
      actorUserId: user.id,
      action: "security.password_change",
      entityType: "User",
      entityId: user.id,
      metadata: { selfService: true },
    }, tx);
  });
  return { success: true as const };
}
