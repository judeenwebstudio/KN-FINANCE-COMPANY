import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeAccount, serializeDepositRequest } from "@/lib/serializers";
import { MemberDepositsClient } from "./deposits-client";

export default async function MemberDepositsPage() {
  const user = await requireMember();
  if (!user.memberProfile) notFound();

  const accounts = await prisma.account.findMany({
    where: { memberId: user.memberProfile.id, status: "ACTIVE" },
    include: { accountTypePolicy: true },
  });

  const requests = await prisma.depositRequest.findMany({
    where: { memberId: user.memberProfile.id },
    include: { account: true },
    orderBy: { createdAt: "desc" },
  });

  const serializedAccounts = accounts.map(serializeAccount);
  const serializedRequests = requests.map(serializeDepositRequest);

  return <MemberDepositsClient accounts={serializedAccounts} requests={serializedRequests} />;
}
