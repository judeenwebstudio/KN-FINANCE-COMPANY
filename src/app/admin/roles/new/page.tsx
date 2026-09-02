import { requirePermission, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { NewRoleClient } from "./new-role-client";

export default async function NewRolePage() {
  const actor = await requirePermission("roles.create");
  const scope = await getUserAuthorizedBranchScope(actor.id);

  if (!scope.global) {
    throw new Error("Only administrators with global branch scope can manage role definitions.");
  }

  return <NewRoleClient />;
}
