"use server";

import { auth } from "@/lib/auth";
import {
  getUnreadNotificationCount,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markNotificationAsClicked,
} from "@/services/notification.service";

export async function getMyUnreadCount() {
  const session = await auth();
  if (!session) return 0;
  return getUnreadNotificationCount(session.user.id);
}

export async function getMyNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const session = await auth();
  if (!session) return [];
  return getNotifications(session.user.id, params);
}

export async function markRead(notificationId: string) {
  const session = await auth();
  if (!session) return;
  await markNotificationAsRead(notificationId, session.user.id);
}

export async function markAllRead() {
  const session = await auth();
  if (!session) return;
  await markAllNotificationsAsRead(session.user.id);
}

export async function markClicked(notificationId: string) {
  const session = await auth();
  if (!session) return;
  await markNotificationAsClicked(notificationId);
}
