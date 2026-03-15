import { prisma } from "@/lib/db";
import type { NotificationPriority, Role } from "@prisma/client";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  leadId?: string | null,
  priority: NotificationPriority = "NORMAL"
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      leadId: leadId ?? undefined,
      priority,
    },
  });
}

export async function createNotificationsForRole(
  role: Role,
  type: string,
  title: string,
  body: string,
  leadId?: string | null,
  priority: NotificationPriority = "NORMAL"
) {
  const users = await prisma.user.findMany({
    where: { role, active: true },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type,
      title,
      body,
      leadId: leadId ?? undefined,
      priority,
    })),
  });
}

export async function createNotificationsForUsers(
  userIds: string[],
  type: string,
  title: string,
  body: string,
  leadId?: string | null,
  priority: NotificationPriority = "NORMAL"
) {
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      leadId: leadId ?? undefined,
      priority,
    })),
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function getNotifications(
  userId: string,
  params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
) {
  const { limit = 20, offset = 0, unreadOnly = false } = params;

  return prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      lead: {
        select: { id: true, companyName: true, fullName: true },
      },
    },
  });
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export async function markNotificationAsClicked(notificationId: string) {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { clicked: true },
  });
}
