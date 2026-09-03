"use server";

// Calls and emails the team had with a lead, written down by hand.
//
// A rep often dials first and types later, so a logged interaction is not a
// finished record: the note stays editable from the timeline, that evening or
// the next morning, by whoever logged it (or any admin).

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { stopRecaptureForLead } from "@/services/recapture.service";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export type InteractionKind = "call" | "email";

/** What happened, and whether it means we actually reached the person. */
export const CALL_OUTCOMES = [
  { value: "spoke", label: "Spoke with them", reached: true },
  { value: "voicemail", label: "Left a voicemail", reached: false },
  { value: "no_answer", label: "No answer", reached: false },
  { value: "callback", label: "They asked to be called back", reached: true },
  { value: "wrong_number", label: "Wrong or bad number", reached: false },
] as const;

export const EMAIL_OUTCOMES = [
  { value: "sent", label: "Sent them an email", reached: true },
  { value: "replied", label: "They replied", reached: true },
  { value: "bounced", label: "It bounced", reached: false },
  { value: "no_reply", label: "No reply yet", reached: false },
] as const;

function outcomeMeta(kind: InteractionKind, value: string) {
  const list: ReadonlyArray<{ value: string; label: string; reached: boolean }> =
    kind === "call" ? CALL_OUTCOMES : EMAIL_OUTCOMES;
  return list.find((o) => o.value === value) ?? null;
}

export interface LogInteractionInput {
  kind: InteractionKind;
  outcome: string;
  note?: string;
  /** When it happened, if not right now. */
  occurredAt?: string;
}

export async function logInteraction(leadId: string, input: LogInteractionInput) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const meta = outcomeMeta(input.kind, input.outcome);
  if (!meta) return { success: false, error: "Pick what happened first." };

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, error: "That lead no longer exists." };

  const occurredAt = input.occurredAt && !Number.isNaN(Date.parse(input.occurredAt))
    ? new Date(input.occurredAt)
    : new Date();

  const event = await prisma.leadEvent.create({
    data: {
      leadId,
      userId: session.user.id,
      eventType: "interaction_logged",
      createdAt: occurredAt,
      eventDataJson: {
        kind: input.kind,
        outcome: input.outcome,
        outcomeLabel: meta.label,
        reached: meta.reached,
        note: (input.note ?? "").trim() || null,
      } as Prisma.InputJsonValue,
    },
  });

  // Reaching somebody is a first contact, and any logged interaction means a
  // person is on this lead, so the automated chasing stops either way.
  const updates: Record<string, unknown> = { lastActivityAt: new Date() };
  if (meta.reached && !lead.firstContactAt) {
    updates.firstContactAt = occurredAt;
    if (["NEW", "REVIEWED"].includes(lead.status)) updates.status = "CONTACTED";
  }
  await prisma.lead.update({ where: { id: leadId }, data: updates as never });
  if (meta.reached && !lead.firstContactAt) {
    await logEvent(leadId, "first_contact_recorded", { via: input.kind }, session.user.id);
  }
  stopRecaptureForLead(leadId, `logged_${input.kind}`).catch(() => {});

  revalidatePath(`/leads/${leadId}`);
  return { success: true, eventId: event.id };
}

/** Fill in or correct the note on a logged call or email after the fact. */
export async function updateInteractionNote(eventId: string, note: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const event = await prisma.leadEvent.findUnique({ where: { id: eventId } });
  if (!event || event.eventType !== "interaction_logged") {
    return { success: false, error: "That entry is no longer here." };
  }
  // Whoever logged it can finish it; admins can tidy anyone's.
  if (event.userId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Only the person who logged this, or an admin, can edit it." };
  }

  const data = (event.eventDataJson ?? {}) as Record<string, unknown>;
  await prisma.leadEvent.update({
    where: { id: eventId },
    data: {
      eventDataJson: {
        ...data,
        note: note.trim() || null,
        editedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/leads/${event.leadId}`);
  return { success: true };
}
