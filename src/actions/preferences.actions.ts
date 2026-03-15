"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const NOTIFICATION_TYPES = [
  "new_lead",
  "lead_assigned",
  "lead_reassigned",
  "sla_warning",
  "sla_breach",
  "sla_escalation",
  "follow_up_due",
  "duplicate_detected",
];

export async function getMyNotificationPreferences() {
  const session = await auth();
  if (!session) return [];

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  });

  // Return all types with defaults for missing ones
  return NOTIFICATION_TYPES.map((type) => {
    const existing = prefs.find((p) => p.notificationType === type);
    return {
      notificationType: type,
      browserPushEnabled: existing?.browserPushEnabled ?? true,
      inAppEnabled: existing?.inAppEnabled ?? true,
      soundEnabled: existing?.soundEnabled ?? true,
    };
  });
}

export async function updateNotificationPreference(
  notificationType: string,
  data: { browserPushEnabled?: boolean; inAppEnabled?: boolean; soundEnabled?: boolean }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.notificationPreference.upsert({
    where: {
      userId_notificationType: {
        userId: session.user.id,
        notificationType,
      },
    },
    update: data,
    create: {
      userId: session.user.id,
      notificationType,
      browserPushEnabled: data.browserPushEnabled ?? true,
      inAppEnabled: data.inAppEnabled ?? true,
      soundEnabled: data.soundEnabled ?? true,
    },
  });

  revalidatePath("/settings");
}

export async function getMySoundPreferences() {
  const session = await auth();
  if (!session) return { soundsEnabled: true, volume: 70 };

  const pref = await prisma.soundPreference.findUnique({
    where: { userId: session.user.id },
  });

  return {
    soundsEnabled: pref?.soundsEnabled ?? true,
    volume: pref?.volume ?? 70,
  };
}

export async function updateSoundPreferences(data: { soundsEnabled?: boolean; volume?: number }) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.soundPreference.upsert({
    where: { userId: session.user.id },
    update: data,
    create: {
      userId: session.user.id,
      soundsEnabled: data.soundsEnabled ?? true,
      volume: data.volume ?? 70,
    },
  });

  revalidatePath("/settings");
}
