import { PortalShell } from "@/components/portal-shell";
import { requireMember } from "@/lib/authz";
import type { PortalUserDTO } from "@/types/portal";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const userRecord = await requireMember();
  const displayName = userRecord.name && userRecord.name.trim().length > 0 ? userRecord.name.trim() : userRecord.email;

  const user: PortalUserDTO = {
    id: String(userRecord.id),
    name: displayName,
    email: String(userRecord.email),
    role: "Member",
  };

  return <PortalShell portal="Member" user={user}>{children}</PortalShell>;
}
