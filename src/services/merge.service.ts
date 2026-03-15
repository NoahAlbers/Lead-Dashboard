import { prisma } from "@/lib/db";
import { logEvent } from "./activity-log.service";
import { scoreAndUpdateLead } from "./scoring.service";
import type { Prisma } from "@prisma/client";

// Fields that can be merged between two leads
const MERGEABLE_FIELDS = [
  "firstName", "lastName", "fullName", "companyName", "title",
  "email", "phone", "alternatePhone",
  "address1", "address2", "city", "state", "zip", "country",
  "industry", "debtType", "balanceAmount", "estimatedClaimValue",
  "accountVolume", "serviceRequested", "notesFromForm", "urgency",
  "businessType", "geographicScope",
  "leadSource", "sourcePage", "utmSource", "utmMedium", "utmCampaign", "referrer",
] as const;

// Array/JSON fields that can be unioned
const UNION_FIELDS = ["states"] as const;

export interface FieldSelection {
  field: string;
  source: "A" | "B" | "union";
}

export async function executeMerge(
  primaryLeadId: string,
  duplicateLeadId: string,
  fieldSelections: FieldSelection[],
  userId: string
) {
  // Fetch both leads fully
  const [primary, duplicate] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: primaryLeadId } }),
    prisma.lead.findUniqueOrThrow({ where: { id: duplicateLeadId } }),
  ]);

  // Snapshot both records
  const primarySnapshot = JSON.parse(JSON.stringify(primary));
  const duplicateSnapshot = JSON.parse(JSON.stringify(duplicate));

  // Build update data from field selections
  const updateData: Record<string, unknown> = {};

  for (const sel of fieldSelections) {
    if (sel.source === "A") {
      // Keep primary value — no update needed
      continue;
    } else if (sel.source === "B") {
      // Use duplicate value
      updateData[sel.field] = (duplicate as Record<string, unknown>)[sel.field];
    } else if (sel.source === "union") {
      // Union array fields
      const aVal = (primary as Record<string, unknown>)[sel.field];
      const bVal = (duplicate as Record<string, unknown>)[sel.field];
      const aArr = Array.isArray(aVal) ? aVal : [];
      const bArr = Array.isArray(bVal) ? bVal : [];
      updateData[sel.field] = [...new Set([...aArr, ...bArr])];
    }
  }

  // Use the more advanced status
  const STATUS_PRIORITY: Record<string, number> = {
    NEW: 0, REVIEWED: 1, CONTACTED: 2, QUALIFIED: 3,
    FOLLOW_UP_NEEDED: 2, REFERRED_OUT: 4, IMPORTED_TO_CRM: 5,
    WON: 6, LOST: 6, DISQUALIFIED: 6, DUPLICATE: 0, ARCHIVED: 0, MERGED: 0,
  };
  const pPriority = STATUS_PRIORITY[primary.status] ?? 0;
  const dPriority = STATUS_PRIORITY[duplicate.status] ?? 0;
  if (dPriority > pPriority) {
    updateData.status = duplicate.status;
  }

  // Keep assignedUser if one has it
  if (!primary.assignedUserId && duplicate.assignedUserId) {
    updateData.assignedUserId = duplicate.assignedUserId;
  }

  // Keep firstContactAt (earliest)
  if (duplicate.firstContactAt && (!primary.firstContactAt || duplicate.firstContactAt < primary.firstContactAt)) {
    updateData.firstContactAt = duplicate.firstContactAt;
  }

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update primary lead
    if (Object.keys(updateData).length > 0) {
      await tx.lead.update({
        where: { id: primaryLeadId },
        data: updateData as Prisma.LeadUpdateInput,
      });
    }

    // 2. Move events from duplicate to primary
    await tx.leadEvent.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    });

    // 3. Move notes from duplicate to primary
    await tx.leadNote.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    });

    // 4. Move CRM exports
    await tx.crmExport.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    });

    // 5. Move follow-up reminders
    await tx.followUpReminder.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    });

    // 6. Move notifications
    await tx.notification.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    });

    // 7. Set duplicate as merged
    await tx.lead.update({
      where: { id: duplicateLeadId },
      data: {
        status: "MERGED",
        mergedIntoLeadId: primaryLeadId,
        mergedAt: new Date(),
      },
    });

    // 8. Create merge history
    await tx.mergeHistory.create({
      data: {
        primaryLeadId,
        duplicateLeadId,
        mergedByUserId: userId,
        primarySnapshotJson: primarySnapshot as Prisma.InputJsonValue,
        duplicateSnapshotJson: duplicateSnapshot as Prisma.InputJsonValue,
        fieldSelectionsJson: fieldSelections as unknown as Prisma.InputJsonValue,
      },
    });
  });

  // 9. Recalculate primary lead score
  await scoreAndUpdateLead(primaryLeadId);

  // 10. Log merge events
  await logEvent(primaryLeadId, "leads_merged", { mergedFromLeadId: duplicateLeadId }, userId);
  await logEvent(duplicateLeadId, "leads_merged", { mergedIntoLeadId: primaryLeadId }, userId);

  return { primaryLeadId, duplicateLeadId };
}

export async function undoMerge(mergeHistoryId: string, userId: string) {
  const history = await prisma.mergeHistory.findUniqueOrThrow({
    where: { id: mergeHistoryId },
  });

  if (history.undone) throw new Error("Merge already undone");

  const primarySnapshot = history.primarySnapshotJson as Record<string, unknown>;
  const duplicateSnapshot = history.duplicateSnapshotJson as Record<string, unknown>;

  // Build restore data for primary (only the mergeable fields)
  const primaryRestore: Record<string, unknown> = {};
  for (const field of MERGEABLE_FIELDS) {
    if (primarySnapshot[field] !== undefined) {
      primaryRestore[field] = primarySnapshot[field];
    }
  }
  // Restore arrays
  for (const field of UNION_FIELDS) {
    if (primarySnapshot[field] !== undefined) {
      primaryRestore[field] = primarySnapshot[field];
    }
  }
  // Restore status and assignment
  primaryRestore.status = primarySnapshot.status;
  primaryRestore.assignedUserId = primarySnapshot.assignedUserId;

  // Build restore data for duplicate
  const duplicateRestore: Record<string, unknown> = {};
  for (const field of MERGEABLE_FIELDS) {
    if (duplicateSnapshot[field] !== undefined) {
      duplicateRestore[field] = duplicateSnapshot[field];
    }
  }
  for (const field of UNION_FIELDS) {
    if (duplicateSnapshot[field] !== undefined) {
      duplicateRestore[field] = duplicateSnapshot[field];
    }
  }
  duplicateRestore.status = duplicateSnapshot.status;
  duplicateRestore.assignedUserId = duplicateSnapshot.assignedUserId;
  duplicateRestore.mergedIntoLeadId = null;
  duplicateRestore.mergedAt = null;

  await prisma.$transaction(async (tx) => {
    // Restore primary
    await tx.lead.update({
      where: { id: history.primaryLeadId },
      data: primaryRestore as Prisma.LeadUpdateInput,
    });

    // Restore duplicate
    await tx.lead.update({
      where: { id: history.duplicateLeadId },
      data: duplicateRestore as Prisma.LeadUpdateInput,
    });

    // Mark merge as undone
    await tx.mergeHistory.update({
      where: { id: mergeHistoryId },
      data: { undone: true, undoneAt: new Date(), undoneByUserId: userId },
    });
  });

  // Recalculate scores
  await scoreAndUpdateLead(history.primaryLeadId);
  await scoreAndUpdateLead(history.duplicateLeadId);

  // Log undo
  await logEvent(history.primaryLeadId, "merge_undone", { mergeHistoryId }, userId);
  await logEvent(history.duplicateLeadId, "merge_undone", { mergeHistoryId }, userId);

  return { primaryLeadId: history.primaryLeadId, duplicateLeadId: history.duplicateLeadId };
}
