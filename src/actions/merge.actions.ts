"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { executeMerge, undoMerge, type FieldSelection } from "@/services/merge.service";

export async function getLeadsForComparison(leadIdA: string, leadIdB: string) {
  const [a, b] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadIdA },
      include: {
        assignedUser: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
        notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      },
    }),
    prisma.lead.findUnique({
      where: { id: leadIdB },
      include: {
        assignedUser: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
        notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  if (!a || !b) throw new Error("One or both leads not found");

  // Serialize Decimal fields
  const serialize = (lead: NonNullable<typeof a>) => ({
    ...lead,
    balanceAmount: lead.balanceAmount ? Number(lead.balanceAmount) : null,
    estimatedClaimValue: lead.estimatedClaimValue ? Number(lead.estimatedClaimValue) : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
    firstContactAt: lead.firstContactAt?.toISOString() ?? null,
    assignedAt: lead.assignedAt?.toISOString() ?? null,
    mergedAt: lead.mergedAt?.toISOString() ?? null,
    slaBreachedAt: lead.slaBreachedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    events: lead.events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    notes: lead.notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });

  return { leadA: serialize(a), leadB: serialize(b) };
}

export async function performMerge(
  primaryLeadId: string,
  duplicateLeadId: string,
  fieldSelections: FieldSelection[]
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const result = await executeMerge(primaryLeadId, duplicateLeadId, fieldSelections, session.user.id);

  revalidatePath(`/leads/${primaryLeadId}`);
  revalidatePath(`/leads/${duplicateLeadId}`);
  revalidatePath("/leads");

  return result;
}

export async function performUndoMerge(mergeHistoryId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Check time limit: 24 hours for non-managers
  const history = await prisma.mergeHistory.findUniqueOrThrow({ where: { id: mergeHistoryId } });
  const hoursSinceMerge = (Date.now() - history.createdAt.getTime()) / 3600000;
  if (hoursSinceMerge > 24 && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    throw new Error("Undo window expired (24 hours). Contact a manager.");
  }

  const result = await undoMerge(mergeHistoryId, session.user.id);

  revalidatePath(`/leads/${result.primaryLeadId}`);
  revalidatePath(`/leads/${result.duplicateLeadId}`);
  revalidatePath("/leads");

  return result;
}

export async function getMergeHistory(leadId: string) {
  return prisma.mergeHistory.findMany({
    where: {
      OR: [{ primaryLeadId: leadId }, { duplicateLeadId: leadId }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function searchLeadsForMerge(query: string, excludeLeadId: string) {
  if (!query || query.length < 2) return [];

  const leads = await prisma.lead.findMany({
    where: {
      id: { not: excludeLeadId },
      status: { notIn: ["MERGED", "ARCHIVED"] },
      OR: [
        { companyName: { contains: query, mode: "insensitive" } },
        { fullName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    select: {
      id: true, companyName: true, fullName: true, email: true, score: true, qualityTier: true, status: true, createdAt: true,
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  return leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }));
}
