import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadNotificationCount, getNotifications } from "@/services/notification.service";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(session.user.id, { limit: 20, unreadOnly: false }),
    getUnreadNotificationCount(session.user.id),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      priority: n.priority,
      read: n.read,
      clicked: n.clicked,
      leadId: n.leadId,
      leadName: n.lead?.companyName || n.lead?.fullName || null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
