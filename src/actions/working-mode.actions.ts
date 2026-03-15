"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/services/activity-log.service";
import type { LeadStatus } from "@prisma/client";

const ACTIVE_STATUSES: LeadStatus[] = ["NEW", "REVIEWED", "CONTACTED", "FOLLOW_UP_NEEDED", "QUALIFIED"];

export async function getWorkingQueue(params: {
  sortField?: string;
  sortDirection?: "asc" | "desc";
  myLeadsOnly?: boolean;
}): Promise<string[]> {
  const session = await auth();
  if (!session) return [];

  const { sortField = "createdAt", sortDirection = "desc", myLeadsOnly = false } = params;

  const where: Record<string, unknown> = {
    status: { in: ACTIVE_STATUSES },
  };

  if (myLeadsOnly) {
    where.assignedUserId = session.user.id;
  } else {
    // Include unassigned + assigned to current user
    where.OR = [
      { assignedUserId: null },
      { assignedUserId: session.user.id },
    ];
  }

  const allowedFields = ["createdAt", "score", "slaStatus", "qualityTier", "companyName"];
  const orderField = allowedFields.includes(sortField) ? sortField : "createdAt";

  const leads = await prisma.lead.findMany({
    where,
    select: { id: true },
    orderBy: { [orderField]: sortDirection },
    take: 200,
  });

  return leads.map((l) => l.id);
}

export type DispositionType =
  | "contacted_will_follow_up"
  | "contacted_qualified"
  | "emailed_awaiting"
  | "called_voicemail"
  | "called_spoke"
  | "needs_follow_up"
  | "referred_out"
  | "not_a_fit"
  | "duplicate"
  | "note_only";

const DISPOSITION_STATUS_MAP: Record<DispositionType, LeadStatus | null> = {
  contacted_will_follow_up: "CONTACTED",
  contacted_qualified: "QUALIFIED",
  emailed_awaiting: "CONTACTED",
  called_voicemail: "CONTACTED",
  called_spoke: "CONTACTED",
  needs_follow_up: "FOLLOW_UP_NEEDED",
  referred_out: "REFERRED_OUT",
  not_a_fit: "DISQUALIFIED",
  duplicate: "DUPLICATE",
  note_only: null,
};

const DISPOSITION_EVENT_MAP: Record<DispositionType, string> = {
  contacted_will_follow_up: "Contacted — Will Follow Up",
  contacted_qualified: "Contacted — Qualified",
  emailed_awaiting: "Emailed — Awaiting Response",
  called_voicemail: "Called — Left Voicemail",
  called_spoke: "Called — Spoke with Contact",
  needs_follow_up: "Needs Follow-Up",
  referred_out: "Referred Out",
  not_a_fit: "Not a Fit — Disqualified",
  duplicate: "Duplicate",
  note_only: "Note Added",
};

export async function recordDisposition(
  leadId: string,
  disposition: DispositionType,
  note?: string,
  followUpAt?: string,
): Promise<{ success: boolean; newStatus: string | null }> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const newStatus = DISPOSITION_STATUS_MAP[disposition];
  const eventLabel = DISPOSITION_EVENT_MAP[disposition];

  // Update status if applicable
  if (newStatus) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const updateData: Record<string, unknown> = { status: newStatus };

    // Record first contact
    if ((newStatus === "CONTACTED" || newStatus === "QUALIFIED") && !lead.firstContactAt) {
      updateData.firstContactAt = new Date();
    }

    await prisma.lead.update({ where: { id: leadId }, data: updateData });
    await logEvent(leadId, "status_changed", { from: lead.status, to: newStatus, disposition }, session.user.id);
  }

  // Log the disposition event
  await logEvent(leadId, "quick_log", { disposition, label: eventLabel, note }, session.user.id);

  // Add note if provided
  if (note?.trim()) {
    await prisma.leadNote.create({
      data: {
        leadId,
        userId: session.user.id,
        noteBody: `[${eventLabel}] ${note}`,
      },
    });
    await logEvent(leadId, "note_added", { notePreview: note.slice(0, 100) }, session.user.id);
  }

  // Create follow-up reminder if requested
  if (followUpAt) {
    await prisma.followUpReminder.create({
      data: {
        leadId,
        userId: session.user.id,
        reminderAt: new Date(followUpAt),
        note: note || undefined,
      },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { nextFollowUpAt: new Date(followUpAt) },
    });
    await logEvent(leadId, "follow_up_scheduled", { reminderAt: followUpAt }, session.user.id);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");

  return { success: true, newStatus };
}
