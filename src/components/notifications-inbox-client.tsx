"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, CheckCircle2, Info, AlertTriangle, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NotificationDTO } from "@/lib/notifications/notification-service";
import { markNotificationAsReadAction, markAllNotificationsAsReadAction } from "@/app/notifications/actions";

export function NotificationsInboxClient({
  initialData,
}: {
  initialData: {
    notifications: NotificationDTO[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
  };
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const handleMarkAsRead = async (id: string) => {
    const res = await markNotificationAsReadAction(id);
    if (res.success) {
      setData((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      }));
      router.refresh();
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    const res = await markAllNotificationsAsReadAction();
    setLoading(false);
    if (res.success) {
      setData((prev) => ({
        ...prev,
        unreadCount: 0,
        notifications: prev.notifications.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      }));
      router.refresh();
    }
  };

  const getEventIcon = (eventKey: string) => {
    switch (eventKey) {
      case "MEMBER_WELCOME":
        return <ShieldCheck className="size-4 text-emerald-600" />;
      case "LOAN_APPROVED":
      case "LOAN_DISBURSED":
        return <CheckCircle2 className="size-4 text-indigo-600" />;
      case "REPAYMENT_RECEIVED":
        return <Mail className="size-4 text-[#275d4f]" />;
      case "OVERDUE_NOTICE":
        return <AlertTriangle className="size-4 text-rose-600" />;
      default:
        return <Info className="size-4 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="size-5 text-[#275d4f]" /> Activity & System Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real runtime notification inbox for account activities and transaction alerts.
          </p>
        </div>
        {data.unreadCount > 0 && (
          <Button
            onClick={handleMarkAllAsRead}
            disabled={loading}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-slate-700 hover:text-slate-900"
          >
            <CheckCheck className="size-3.5 text-emerald-600" />
            Mark All as Read ({data.unreadCount})
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        {data.notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bell className="mx-auto size-10 text-slate-300 mb-2" />
            <p className="font-semibold text-sm text-slate-800">Inbox is empty</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You have no active notifications. System alerts, approval updates, and transaction receipts will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 bg-white">
            {data.notifications.map((item) => {
              const isUnread = !item.readAt;
              return (
                <div
                  key={item.id}
                  className={`p-4 transition-colors flex items-start gap-4 ${
                    isUnread ? "bg-slate-50/90 font-medium" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-slate-100 border border-slate-200">
                    {getEventIcon(item.eventKey)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-xs ${isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                          {item.title}
                        </h3>
                        {isUnread && (
                          <span className="inline-block size-2 rounded-full bg-rose-500 shadow-xs" title="Unread" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>

                    {item.targetUrl && (
                      <div className="mt-2">
                        <Link
                          href={item.targetUrl}
                          className="text-[11px] font-semibold text-[#275d4f] hover:underline inline-flex items-center gap-1"
                        >
                          View Details &rarr;
                        </Link>
                      </div>
                    )}
                  </div>

                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(item.id)}
                      className="h-7 text-[11px] text-slate-500 hover:text-slate-900 shrink-0"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong> ({data.total} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => router.push(`?page=${data.page - 1}`)}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => router.push(`?page=${data.page + 1}`)}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
