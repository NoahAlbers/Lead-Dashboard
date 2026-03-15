"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/services/activity-log.service";

export async function createFollowUpReminder(leadId: string, reminderAt: string, note?: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const reminder = await prisma.followUpReminder.create({
    data: {
      leadId,
      userId: session.user.id,
      reminderAt: new Date(reminderAt),
      note: note || undefined,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt: new Date(reminderAt) },
  });

  await logEvent(leadId, "follow_up_scheduled", { reminderAt, note }, session.user.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");

  return reminder;
}

export async function completeFollowUpReminder(reminderId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const reminder = await prisma.followUpReminder.update({
    where: { id: reminderId },
    data: { completed: true, completedAt: new Date() },
  });

  // Check if there are other pending reminders for this lead
  const pending = await prisma.followUpReminder.findFirst({
    where: { leadId: reminder.leadId, completed: false },
    orderBy: { reminderAt: "asc" },
  });

  await prisma.lead.update({
    where: { id: reminder.leadId },
    data: { nextFollowUpAt: pending?.reminderAt ?? null },
  });

  await logEvent(reminder.leadId, "follow_up_completed", { reminderId }, session.user.id);
  revalidatePath(`/leads/${reminder.leadId}`);
  return reminder;
}

export async function getMyPendingFollowUps() {
  const session = await auth();
  if (!session) return [];

  return prisma.followUpReminder.findMany({
    where: { userId: session.user.id, completed: false },
    include: {
      lead: { select: { id: true, companyName: true, fullName: true, qualityTier: true, score: true } },
    },
    orderBy: { reminderAt: "asc" },
  });
}
