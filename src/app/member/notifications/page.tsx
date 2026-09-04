import { requireMember } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default async function MemberNotificationsPage() {
  await requireMember();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Bell className="size-6 text-indigo-600" /> Notifications & Alerts
        </h1>
        <p className="text-sm text-slate-500">
          Official member communication logs and activity notices.
        </p>
      </div>

      <Card className="p-12 text-center bg-white border-slate-200 shadow-xs rounded-2xl space-y-3">
        <Bell className="mx-auto size-12 text-slate-300 mb-2" />
        <h2 className="text-base font-bold text-slate-900">No New Notifications</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          You have no unread notifications or security alerts at this time. Automated event notifications will appear here when triggered.
        </p>
      </Card>
    </div>
  );
}
