import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type EventType =
  | "lead_created"
  | "score_calculated"
  | "status_changed"
  | "note_added"
  | "email_action_opened"
  | "call_action_opened"
  | "referral_action_opened"
  | "referral_marked_sent"
  | "crm_exported"
  | "crm_imported"
  | "duplicate_flagged"
  | "assigned_user_changed"
  | "quick_log";

export async function logEvent(
  leadId: string,
  eventType: EventType,
  data?: Record<string, unknown>,
  userId?: string
) {
  const event = await prisma.leadEvent.create({
    data: {
      leadId,
      eventType,
      eventDataJson: (data ?? {}) as Prisma.InputJsonValue,
      userId: userId ?? null,
    },
  });

  // Update last activity timestamp on lead
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastActivityAt: new Date() },
  });

  return event;
}

export async function getLeadEvents(leadId: string) {
  return prisma.leadEvent.findMany({
    where: { leadId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
