"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { revalidatePath } from "next/cache";

export async function addNote(leadId: string, noteBody: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const note = await prisma.leadNote.create({
    data: {
      leadId,
      userId: session.user.id,
      noteBody,
    },
  });

  await logEvent(
    leadId,
    "note_added",
    { noteId: note.id },
    session.user.id
  );

  revalidatePath(`/leads/${leadId}`);
  return note;
}

export async function getLeadNotes(leadId: string) {
  return prisma.leadNote.findMany({
    where: { leadId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function logQuickAction(
  leadId: string,
  actionType: string,
  details?: string
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await logEvent(
    leadId,
    "quick_log",
    { actionType, details },
    session.user.id
  );

  // Update status based on action type
  const statusMap: Record<string, string> = {
    "contacted_email": "CONTACTED",
    "contacted_phone": "CONTACTED",
    "left_voicemail": "CONTACTED",
    "referral_sent": "REFERRED_OUT",
    "follow_up_scheduled": "FOLLOW_UP_NEEDED",
    "not_a_fit": "DISQUALIFIED",
    "imported_to_crm": "IMPORTED_TO_CRM",
    "duplicate_found": "DUPLICATE",
  };

  const newStatus = statusMap[actionType];
  if (newStatus) {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: newStatus as never },
    });

    await logEvent(
      leadId,
      "status_changed",
      { from: lead.status, to: newStatus, triggeredBy: actionType },
      session.user.id
    );
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}
