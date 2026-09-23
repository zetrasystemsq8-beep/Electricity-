import { prisma } from "../lib/prisma";
import { NotificationCategory } from "@prisma/client";

export async function createNotification(
  userId: string,
  params: { category: NotificationCategory; title: string; body: string }
) {
  return prisma.notification.create({
    data: { userId, category: params.category, title: params.title, body: params.body },
  });
}

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!notification) return null;
  return prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
}
