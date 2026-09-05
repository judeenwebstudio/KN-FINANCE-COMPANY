import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { getEmailProviderStatus } from "@/lib/settings/email-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requirePermission("users.manage");
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const providerStatus = getEmailProviderStatus();
    if (!providerStatus.configured) {
      // Log audit event and return truthful response to Admin
      await requestPasswordReset(user.email, actor.id);
      return NextResponse.json({
        success: false,
        delivered: false,
        message: "Password reset delivery unavailable — email provider not configured.",
      });
    }

    await requestPasswordReset(user.email, actor.id);
    return NextResponse.json({
      success: true,
      delivered: true,
      message: "Password reset instructions sent successfully.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to initiate password reset.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
