"use server";

import { getCurrentUser } from "@/lib/authz";
import {
  getUserNotificationSummary,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationSummaryDTO,
  NotificationDTO,
} from "@/lib/notifications/notification-service";

export async function getNavbarNotificationSummaryAction(): Promise<{
  success: boolean;
  data?: NotificationSummaryDTO;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    const summary = await getUserNotificationSummary(user.id);
    return { success: true, data: summary };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to fetch notification summary." };
  }
}

export async function getUserNotificationsAction(
  page = 1,
  pageSize = 20,
): Promise<{
  success: boolean;
  data?: { notifications: NotificationDTO[]; total: number; page: number; totalPages: number; unreadCount: number };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    const result = await getUserNotifications(user.id, page, pageSize);
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to fetch notifications." };
  }
}

export async function markNotificationAsReadAction(
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    return await markNotificationAsRead(user.id, notificationId);
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to mark notification as read." };
  }
}

export async function markAllNotificationsAsReadAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    const result = await markAllNotificationsAsRead(user.id);
    return { success: true, count: result.count };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to mark all notifications as read." };
  }
}
