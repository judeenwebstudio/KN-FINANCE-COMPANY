import { prisma } from "../prisma";

export type NotificationDTO = {
  id: string;
  userId: string;
  eventKey: string;
  title: string;
  message: string;
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationSummaryDTO = {
  unreadCount: number;
  recentNotifications: NotificationDTO[];
};

export async function createNotification(params: {
  userId: string;
  eventKey: string;
  title: string;
  message: string;
  targetUrl?: string;
}): Promise<NotificationDTO> {
  const notif = await prisma.notification.create({
    data: {
      userId: params.userId,
      eventKey: params.eventKey,
      title: params.title,
      message: params.message,
      referenceUrl: params.targetUrl,
    },
  });

  return {
    id: notif.id,
    userId: notif.userId,
    eventKey: notif.eventKey,
    title: notif.title,
    message: notif.message,
    targetUrl: notif.referenceUrl,
    readAt: notif.readAt ? notif.readAt.toISOString() : null,
    createdAt: notif.createdAt.toISOString(),
  };
}

export async function getUserNotificationSummary(
  userId: string,
): Promise<NotificationSummaryDTO> {
  const [unreadCount, recentItems] = await Promise.all([
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    unreadCount,
    recentNotifications: recentItems.map((n) => ({
      id: n.id,
      userId: n.userId,
      eventKey: n.eventKey,
      title: n.title,
      message: n.message,
      targetUrl: n.referenceUrl,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function getUserNotifications(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<{ notifications: NotificationDTO[]; total: number; page: number; totalPages: number; unreadCount: number }> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const skip = (safePage - 1) * safeSize;

  const [total, unreadCount, items] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: safeSize,
    }),
  ]);

  const totalPages = Math.ceil(total / safeSize) || 1;

  return {
    notifications: items.map((n) => ({
      id: n.id,
      userId: n.userId,
      eventKey: n.eventKey,
      title: n.title,
      message: n.message,
      targetUrl: n.referenceUrl,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    page: safePage,
    totalPages,
    unreadCount,
  };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    return { success: false, error: "Notification not found or access denied." };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  return { success: true };
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<{ success: boolean; count: number }> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return { success: true, count: res.count };
}
