"use server";

// Extra people at the same company.
//
// The lead's own name, email and phone stay the primary contact: that is who
// filled in the form, and every email, referral and export already points at
// them. Everything here is the second and third person a rep picks up along the
// way, kept beside the lead rather than replacing anything on it.

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { revalidatePath } from "next/cache";

export interface ContactInput {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  notes?: string | null;
}

function clean(input: ContactInput) {
  const t = (v: string | null | undefined) => (v ?? "").trim() || null;
  return {
    name: input.name.trim(),
    title: t(input.title),
    email: t(input.email),
    phone: t(input.phone),
    alternatePhone: t(input.alternatePhone),
    notes: t(input.notes),
  };
}

export async function addLeadContact(leadId: string, input: ContactInput) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = clean(input);
  if (!data.name) return { success: false, error: "Give this person a name first." };

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { success: false, error: "That lead no longer exists." };

  const contact = await prisma.leadContact.create({
    data: { ...data, leadId, createdById: session.user.id },
  });
  await logEvent(leadId, "contact_added", { name: data.name, title: data.title }, session.user.id);

  revalidatePath(`/leads/${leadId}`);
  return { success: true, contactId: contact.id };
}

export async function updateLeadContact(contactId: string, input: ContactInput) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = clean(input);
  if (!data.name) return { success: false, error: "Give this person a name first." };

  const existing = await prisma.leadContact.findUnique({ where: { id: contactId } });
  if (!existing) return { success: false, error: "That contact is no longer here." };

  await prisma.leadContact.update({ where: { id: contactId }, data });
  await logEvent(existing.leadId, "contact_updated", { name: data.name }, session.user.id);

  revalidatePath(`/leads/${existing.leadId}`);
  return { success: true };
}

export async function deleteLeadContact(contactId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.leadContact.findUnique({ where: { id: contactId } });
  if (!existing) return { success: true };

  await prisma.leadContact.delete({ where: { id: contactId } });
  await logEvent(existing.leadId, "contact_removed", { name: existing.name }, session.user.id);

  revalidatePath(`/leads/${existing.leadId}`);
  return { success: true };
}
