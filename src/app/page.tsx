import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import { getUserEffectivePermissions } from "@/lib/auth/authorize";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const permissions = await getUserEffectivePermissions(user.id);
  if (permissions.has("dashboard.view")) redirect("/admin/dashboard");
  if (user.memberProfile) redirect("/member/dashboard");
  redirect("/login");
}
