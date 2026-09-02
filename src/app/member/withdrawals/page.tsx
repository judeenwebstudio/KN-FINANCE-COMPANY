import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeAccount, serializeWithdrawalRequest } from "@/lib/serializers";
import { MemberWithdrawalsClient } from "./withdrawals-client";

export default async function MemberWithdrawalsPage() {
  const user = await requireMember();
  if (!user.memberProfile) notFound();

  const accounts = await prisma.account.findMany({
    where: { memberId: user.memberProfile.id, status: "ACTIVE" },
    include: { accountTypePolicy: true },
  });

  const requests = await prisma.withdrawalRequest.findMany({
    where: { memberId: user.memberProfile.id },
    include: { account: true },
    orderBy: { createdAt: "desc" },
  });

  const serializedAccounts = accounts.map(serializeAccount);
  const serializedRequests = requests.map(serializeWithdrawalRequest);

  return <MemberWithdrawalsClient accounts={serializedAccounts} requests={serializedRequests} />;
}
