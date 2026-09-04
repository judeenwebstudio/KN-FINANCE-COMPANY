import { getCurrentUser } from "@/lib/authz";
import { getUserNotifications } from "@/lib/notifications/notification-service";
import { NotificationsInboxClient } from "@/components/notifications-inbox-client";
import { redirect } from "next/navigation";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10) || 1;

  const initialData = await getUserNotifications(user.id, page, 15);

  return <NotificationsInboxClient initialData={initialData} />;
}
