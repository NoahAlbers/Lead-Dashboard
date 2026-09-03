"use server";

// Correcting an answer the visitor gave on the intake form.
//
// Those answers live in the lead's raw payload rather than in columns, because
// the form asks more than the lead table stores. A rep who spots a wrong answer
// on a call should be able to fix it in place, so this writes back into the
// same payload the lead page reads from, and leaves the correction in the
// timeline like any other edit.

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

/** Only these keys can be edited by hand. Anything else is left to the form. */
const EDITABLE_INTAKE_FIELDS = new Set([
  "companyWebsite",
  "priorAgency",
  "debtTypes",
  "debtsNow",
  "states",
  "ownershipType",
  "totalUnits",
  "rentalTypes",
  "propertyTypes",
  "listingSites",
  "pmSoftware",
  "comments",
]);

export async function updateLeadIntakeField(
  leadId: string,
  field: string,
  value: string | string[] | null,
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!EDITABLE_INTAKE_FIELDS.has(field)) {
    return { success: false, error: "That answer cannot be edited here." };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, error: "That lead no longer exists." };

  const payload = { ...((lead.rawPayloadJson ?? {}) as Record<string, unknown>) };
  // Submissions from the intake form keep their answers one level down. Older
  // and imported leads keep them at the top, so we write wherever they live.
  const nested = payload._rawIntakeForm as Record<string, unknown> | undefined;
  const target = nested && typeof nested === "object" ? { ...nested } : payload;

  const next = Array.isArray(value)
    ? value.map((v) => v.trim()).filter(Boolean)
    : (value ?? "").trim() || null;
  const before = target[field] ?? null;

  const same = Array.isArray(next)
    ? Array.isArray(before) && before.length === next.length && before.every((v, i) => v === next[i])
    : before === next;
  if (same) return { success: true, changed: 0 };

  if (next === null || (Array.isArray(next) && next.length === 0)) {
    delete target[field];
  } else {
    target[field] = next;
  }

  const updated = nested && typeof nested === "object" ? { ...payload, _rawIntakeForm: target } : target;

  await prisma.lead.update({
    where: { id: leadId },
    data: { rawPayloadJson: updated as Prisma.InputJsonValue },
  });

  const asText = (v: unknown) =>
    v == null ? null : Array.isArray(v) ? v.join(", ") : String(v);
  await logEvent(
    leadId,
    "lead_edited",
    { changes: [{ field: `Form answer: ${field}`, from: asText(before), to: asText(next) }] },
    session.user.id,
  );

  revalidatePath(`/leads/${leadId}`);
  return { success: true, changed: 1 };
}
