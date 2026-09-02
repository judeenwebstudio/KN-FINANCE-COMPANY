import { PortalShell } from "@/components/portal-shell";
import { requireMember } from "@/lib/authz";
import type { PortalUserDTO } from "@/types/portal";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const userRecord = await requireMember();
  const user: PortalUserDTO = {
    id: String(userRecord.id),
    name: String(userRecord.name),
    email: String(userRecord.email),
    role: String(userRecord.role),
  };

  return <PortalShell portal="Member" user={user}>{children}</PortalShell>;
}
