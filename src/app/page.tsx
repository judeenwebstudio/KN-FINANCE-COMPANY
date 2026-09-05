import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import { hasAdminPortalAccess } from "@/lib/auth/authorize";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = await hasAdminPortalAccess(user.id);
  if (isAdmin) redirect("/admin/dashboard");
  if (user.memberProfile) redirect("/member/dashboard");
  redirect("/login");
}
