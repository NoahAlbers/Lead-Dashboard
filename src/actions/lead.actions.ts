"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { scoreAndUpdateLead } from "@/services/scoring.service";
import { Prisma, type LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { estStartOfDay, estDateStringToUtcStart, estDateStringToUtcEnd } from "@/lib/timezone";
import { hasAnyStates, buildStateClassWhere, numericRange } from "@/lib/lead-state-filter";
import { getStateClassifications } from "@/actions/state-classification.actions";

export async function getLeads(params: {
  search?: string;
  status?: string[];
  qualityTier?: string[];
  state?: string;
  states?: string[];
  statesOp?: string;
  stateClass?: string;
  assignedUserId?: string[];
  slaStatus?: string[];
  unitsMin?: number;
  unitsMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  rentMin?: number;
  rentMax?: number;
  industry?: string;
  debtType?: string;
  businessType?: string;
  dateFrom?: string;
  dateTo?: string;
  isRead?: string;
  ageMin?: number;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
}) {
  const {
    search,
    status,
    qualityTier,
    state,
    states,
    statesOp,
    stateClass,
    assignedUserId,
    dateFrom,
    dateTo,
    isRead,
    page = 1,
    pageSize = 25,
    sortField = "createdAt",
    sortDirection = "desc",
  } = params;

  const where: Prisma.LeadWhereInput = {};
  // Composite conditions that each build their own OR (state filters) are
  // accumulated here so they AND-combine without clobbering `where.OR` (search).
  const and: Prisma.LeadWhereInput[] = [];

  // Exclude ARCHIVED leads by default unless explicitly filtering for them
  if (status?.length) {
    where.status = { in: status as LeadStatus[] };
  } else {
    where.status = { notIn: ["ARCHIVED", "MERGED"] };
  }

  if (search?.trim()) {
    // Robust search: split into terms (every term must match — AND), each term
    // matching ANY of a broad field set (OR). So "acme florida" needs both.
    const terms = search.trim().split(/\s+/).filter(Boolean);
    const fieldsFor = (term: string): Prisma.LeadWhereInput[] => [
      { fullName: { contains: term, mode: "insensitive" } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { companyName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
      { alternatePhone: { contains: term } },
      { city: { contains: term, mode: "insensitive" } },
      { state: { contains: term, mode: "insensitive" } },
      { zip: { contains: term, mode: "insensitive" } },
      { debtType: { contains: term, mode: "insensitive" } },
      { industry: { contains: term, mode: "insensitive" } },
      { businessType: { contains: term, mode: "insensitive" } },
      { title: { contains: term, mode: "insensitive" } },
      { notesFromForm: { contains: term, mode: "insensitive" } },
    ];
    for (const term of terms) {
      and.push({ OR: fieldsFor(term) });
    }
  }

  if (qualityTier?.length) {
    where.qualityTier = { in: qualityTier };
  }

  // Legacy single-state param — route through the array-aware helper so it also
  // matches leads where the state lives in the `states` JSON array.
  if (state) {
    and.push(hasAnyStates([state]));
  }

  // Explicit multi-state selection (abbrev or name), with any/none operator.
  if (states?.length) {
    const sw = hasAnyStates(states);
    and.push(statesOp === "none" ? { NOT: sw } : sw);
  }

  // Classification mode (good/bad/mixed/unknown) over the combined state set.
  if (stateClass) {
    const classifications = await getStateClassifications();
    const cw = buildStateClassWhere(stateClass, classifications);
    if (cw) and.push(cw);
  }

  // Assignee — multi-select, supports the "__unassigned__" sentinel and mixes.
  if (assignedUserId?.length) {
    const wantsUnassigned = assignedUserId.includes("__unassigned__");
    const ids = assignedUserId.filter((v) => v !== "__unassigned__");
    if (wantsUnassigned && ids.length === 0) {
      where.assignedUserId = null;
    } else if (!wantsUnassigned && ids.length > 0) {
      where.assignedUserId = ids.length === 1 ? ids[0] : { in: ids };
    } else if (wantsUnassigned && ids.length > 0) {
      and.push({ OR: [{ assignedUserId: { in: ids } }, { assignedUserId: null }] });
    }
  }

  // Numeric range filters (>, <, =, between via min/max pairs).
  const unitsR = numericRange(params.unitsMin, params.unitsMax);
  if (unitsR) where.accountVolumeNum = unitsR;
  const scoreR = numericRange(params.scoreMin, params.scoreMax);
  if (scoreR) where.score = scoreR;
  const rentR = numericRange(params.rentMin, params.rentMax);
  if (rentR) where.avgRentNum = rentR;

  // Free-text categorical filters.
  if (params.industry) where.industry = { contains: params.industry, mode: "insensitive" };
  if (params.debtType) where.debtType = { contains: params.debtType, mode: "insensitive" };
  if (params.businessType) where.businessType = { contains: params.businessType, mode: "insensitive" };

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = estDateStringToUtcStart(dateFrom);
    if (dateTo) where.createdAt.lte = estDateStringToUtcEnd(dateTo);
  }

  if (params.slaStatus?.length) {
    where.slaStatus = { in: params.slaStatus };
  }

  if (isRead === "false") {
    where.isRead = false;
  } else if (isRead === "true") {
    where.isRead = true;
  }

  if (params.ageMin && params.ageMin > 0) {
    const cutoff = new Date(Date.now() - params.ageMin * 86400000);
    where.createdAt = {
      ...(where.createdAt as Record<string, Date> | undefined),
      lte: cutoff,
    };
  }

  const allowedSortFields = [
    "createdAt",
    "companyName",
    "fullName",
    "email",
    "phone",
    "state",
    "score",
    "status",
    "qualityTier",
    "recommendedAction",
    "lastActivityAt",
    "balanceAmount",
    "industry",
    "debtType",
    "accountVolume",
    "accountVolumeNum",
    "avgRentNum",
    "urgency",
    "serviceRequested",
    "businessType",
    "slaStatus",
  ];

  const orderField = allowedSortFields.includes(sortField)
    ? sortField
    : "createdAt";

  if (and.length) where.AND = and;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true } },
        recommendedReferral: { select: { id: true, name: true } },
      },
      orderBy: { [orderField]: sortDirection },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    leads: leads.map((l) => ({
      ...l,
      balanceAmount: l.balanceAmount ? Number(l.balanceAmount) : null,
      estimatedClaimValue: l.estimatedClaimValue
        ? Number(l.estimatedClaimValue)
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      recommendedReferral: true,
      duplicateOfLead: {
        select: { id: true, fullName: true, companyName: true },
      },
      duplicateLeads: {
        select: { id: true, fullName: true, companyName: true },
      },
    },
  });

  if (!lead) return null;

  return {
    ...lead,
    balanceAmount: lead.balanceAmount ? Number(lead.balanceAmount) : null,
    estimatedClaimValue: lead.estimatedClaimValue
      ? Number(lead.estimatedClaimValue)
      : null,
  };
}

export async function updateLeadStatus(leadId: string, newStatus: LeadStatus) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const oldStatus = lead.status;

  // Record first contact if moving to CONTACTED and no prior first contact
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "CONTACTED" && !lead.firstContactAt) {
    updateData.firstContactAt = new Date();
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
  });

  if (newStatus === "CONTACTED" && !lead.firstContactAt) {
    await logEvent(leadId, "first_contact_recorded", {}, session.user.id);
  }

  await logEvent(
    leadId,
    "status_changed",
    { from: oldStatus, to: newStatus },
    session.user.id
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function archiveLead(leadId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const oldStatus = lead.status;

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "ARCHIVED" },
  });

  await logEvent(
    leadId,
    "status_changed",
    { from: oldStatus, to: "ARCHIVED" },
    session.user.id
  );

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function unarchiveLead(leadId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "NEW" },
  });

  await logEvent(
    leadId,
    "status_changed",
    { from: "ARCHIVED", to: "NEW" },
    session.user.id
  );

  revalidatePath("/leads");
  revalidatePath("/admin/settings");
  revalidatePath(`/leads/${leadId}`);
}

export async function assignLead(leadId: string, userId: string | null, reason?: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { assignedUserId: true, companyName: true, fullName: true, qualityTier: true } });
  const fromUserId = lead.assignedUserId;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedUserId: userId,
      assignedAt: userId ? new Date() : null,
      claimedBySelf: false,
    },
  });

  // Create assignment log
  await prisma.assignmentLog.create({
    data: {
      leadId,
      fromUserId,
      toUserId: userId,
      assignedByUserId: session.user.id,
      reason,
    },
  });

  await logEvent(
    leadId,
    "assigned_user_changed",
    { fromUserId, toUserId: userId, reason },
    session.user.id
  );

  // Notify the new assignee
  if (userId && userId !== session.user.id) {
    const { createNotification } = await import("@/services/notification.service");
    const leadLabel = lead.companyName || lead.fullName || "Lead";
    await createNotification(
      userId,
      "lead_assigned",
      `Assigned: ${leadLabel}`,
      `You've been assigned ${leadLabel} (${lead.qualityTier ?? "Unscored"})`,
      leadId,
      "NORMAL"
    ).catch(() => {});
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function claimLead(leadId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { assignedUserId: true } });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedUserId: session.user.id,
      assignedAt: new Date(),
      claimedBySelf: true,
    },
  });

  await prisma.assignmentLog.create({
    data: {
      leadId,
      fromUserId: lead.assignedUserId,
      toUserId: session.user.id,
      assignedByUserId: session.user.id,
      reason: "Self-claimed",
    },
  });

  await logEvent(leadId, "assigned_user_changed", { toUserId: session.user.id, selfClaimed: true }, session.user.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function bulkAssignLeads(leadIds: string[], userId: string, reason?: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  for (const leadId of leadIds) {
    await assignLead(leadId, userId, reason);
  }

  revalidatePath("/leads");
}

export async function bulkUpdateStatus(leadIds: string[], newStatus: LeadStatus) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  for (const leadId of leadIds) {
    await updateLeadStatus(leadId, newStatus);
  }

  revalidatePath("/leads");
}

export async function markDuplicate(leadId: string, duplicateOfId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "DUPLICATE",
      duplicateOfLeadId: duplicateOfId,
    },
  });

  await logEvent(
    leadId,
    "duplicate_flagged",
    { duplicateOfLeadId: duplicateOfId },
    session.user.id
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function recalculateScore(leadId: string) {
  await scoreAndUpdateLead(leadId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function getLeadStats() {
  const today = estStartOfDay();

  const [
    newToday,
    uncontacted,
    highQuality,
    followUpNeeded,
    total,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: today }, status: "NEW" } }),
    prisma.lead.count({ where: { status: { in: ["NEW", "REVIEWED"] } } }),
    prisma.lead.count({ where: { qualityTier: "A", status: { notIn: ["ARCHIVED", "MERGED"] } } }),
    prisma.lead.count({ where: { status: "FOLLOW_UP_NEEDED" } }),
    prisma.lead.count({ where: { status: { notIn: ["ARCHIVED", "MERGED"] } } }),
  ]);

  return {
    newToday,
    uncontacted,
    highQuality,
    followUpNeeded,
    total,
  };
}

export async function getWidgetMetrics(metricIds: string[]): Promise<Record<string, number | string>> {
  const today = estStartOfDay();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const notArchived = { status: { notIn: ["ARCHIVED", "MERGED"] as LeadStatus[] } };

  const results: Record<string, number | string> = {};

  const fetchers: Record<string, () => Promise<number | string>> = {
    new_today: () => prisma.lead.count({ where: { createdAt: { gte: today }, status: "NEW" } }),
    new_week: () => prisma.lead.count({ where: { createdAt: { gte: weekAgo }, ...notArchived } }),
    new_month: () => prisma.lead.count({ where: { createdAt: { gte: monthAgo }, ...notArchived } }),
    total: () => prisma.lead.count({ where: notArchived }),
    uncontacted: () => prisma.lead.count({ where: { status: { in: ["NEW", "REVIEWED"] } } }),
    unread: () => prisma.lead.count({ where: { isRead: false, ...notArchived } }),
    follow_up: () => prisma.lead.count({ where: { status: "FOLLOW_UP_NEEDED" } }),
    contacted: () => prisma.lead.count({ where: { status: "CONTACTED" } }),
    referred: () => prisma.lead.count({ where: { status: "REFERRED_OUT" } }),
    disqualified: () => prisma.lead.count({ where: { status: "DISQUALIFIED" } }),
    duplicates: () => prisma.lead.count({ where: { status: "DUPLICATE" } }),
    a_leads: async () => {
      const { getTierRanges } = await import("@/actions/status.actions");
      const tiers = await getTierRanges();
      const tierName = tiers[0]?.name ?? "A Lead";
      return prisma.lead.count({ where: { qualityTier: tierName, ...notArchived } });
    },
    b_leads: async () => {
      const { getTierRanges } = await import("@/actions/status.actions");
      const tiers = await getTierRanges();
      const tierName = tiers[1]?.name ?? "B Lead";
      return prisma.lead.count({ where: { qualityTier: tierName, ...notArchived } });
    },
    c_leads: async () => {
      const { getTierRanges } = await import("@/actions/status.actions");
      const tiers = await getTierRanges();
      const tierName = tiers[2]?.name ?? "C Lead";
      return prisma.lead.count({ where: { qualityTier: tierName, ...notArchived } });
    },
    poor_leads: async () => {
      const { getTierRanges } = await import("@/actions/status.actions");
      const tiers = await getTierRanges();
      const tierName = tiers[3]?.name ?? "Poor Fit";
      return prisma.lead.count({ where: { qualityTier: tierName, ...notArchived } });
    },
    avg_score: async () => {
      const result = await prisma.lead.aggregate({ where: { score: { not: null }, ...notArchived }, _avg: { score: true } });
      return result._avg.score != null ? Math.round(result._avg.score) : 0;
    },
    good_states: async () => {
      // Count leads where any state is classified as good
      try {
        const { getStateClassificationMap } = await import("@/actions/state-classification.actions");
        const classMap = await getStateClassificationMap();
        const goodAbbrevs = Object.entries(classMap).filter(([, c]) => c === "good").map(([a]) => a);
        // Count leads with state in good states
        return prisma.lead.count({
          where: {
            ...notArchived,
            OR: goodAbbrevs.map((s) => ({ state: { equals: s, mode: "insensitive" as const } })),
          },
        });
      } catch { return 0; }
    },
    bad_states: async () => {
      try {
        const { getStateClassificationMap } = await import("@/actions/state-classification.actions");
        const classMap = await getStateClassificationMap();
        const bannedAbbrevs = Object.entries(classMap).filter(([, c]) => c === "banned").map(([a]) => a);
        return prisma.lead.count({
          where: {
            ...notArchived,
            OR: bannedAbbrevs.map((s) => ({ state: { equals: s, mode: "insensitive" as const } })),
          },
        });
      } catch { return 0; }
    },
    total_value: async () => {
      const result = await prisma.lead.aggregate({ where: notArchived, _sum: { balanceAmount: true } });
      const val = result._sum.balanceAmount ? Number(result._sum.balanceAmount) : 0;
      return `$${Math.round(val).toLocaleString()}`;
    },
    total_units: async () => {
      // Sum accountVolume which is stored as string
      const leads = await prisma.lead.findMany({ where: { accountVolume: { not: null }, ...notArchived }, select: { accountVolume: true } });
      return leads.reduce((sum, l) => sum + (parseInt(l.accountVolume ?? "0", 10) || 0), 0);
    },
    sla_breached: () => prisma.lead.count({ where: { slaStatus: { in: ["breached", "escalated"] }, ...notArchived } }),
    sla_at_risk: () => prisma.lead.count({ where: { slaStatus: { in: ["warning", "breached", "escalated"] }, ...notArchived } }),
    aging_stale: () => prisma.lead.count({ where: { createdAt: { lte: new Date(Date.now() - 7 * 86400000) }, ...notArchived } }),
  };

  const promises = metricIds.map(async (id) => {
    const fetcher = fetchers[id];
    if (fetcher) {
      results[id] = await fetcher();
    }
  });

  await Promise.all(promises);
  return results;
}

export async function markLeadAsRead(leadId: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { isRead: true },
  });
  revalidatePath("/leads");
}

export async function toggleReadStatus(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.lead.update({
    where: { id: leadId },
    data: { isRead: !lead.isRead },
  });
  revalidatePath("/leads");
}

export async function bulkMarkAsRead(leadIds: string[]) {
  await prisma.lead.updateMany({
    where: { id: { in: leadIds } },
    data: { isRead: true },
  });
  revalidatePath("/leads");
}

export async function getUnreadCount() {
  return prisma.lead.count({
    where: { isRead: false, status: { notIn: ["ARCHIVED", "MERGED"] } },
  });
}

export async function bulkArchiveLeads(leadIds: string[]) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized: Manager or Admin required");
  }
  for (const id of leadIds) {
    await updateLeadStatus(id, "ARCHIVED");
  }
  revalidatePath("/leads");
}

export async function logResearch(
  leadId: string,
  data: {
    sources: string[];
    companyVerified: string;
    contactVerified: string;
    companySize: string;
    redFlags: string[];
    recommendation: string;
    findings: string;
  }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Create event
  await prisma.leadEvent.create({
    data: {
      leadId,
      eventType: "research_completed",
      eventDataJson: data,
      userId: session.user.id,
    },
  });

  // Create formatted note
  const noteLines = [
    `Research completed by ${session.user.name}`,
    `Sources: ${data.sources.join(", ")}`,
    `Company verified: ${data.companyVerified}`,
    `Contact verified: ${data.contactVerified}`,
    `Company size: ${data.companySize}`,
    data.redFlags.length > 0 ? `Red flags: ${data.redFlags.join(", ")}` : null,
    `Recommendation: ${data.recommendation}`,
    data.findings ? `Findings: ${data.findings}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.leadNote.create({
    data: {
      leadId,
      noteBody: noteLines,
      userId: session.user.id,
    },
  });

  // Update lastActivityAt
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastActivityAt: new Date() },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function recalculateAllScores() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ["ARCHIVED", "MERGED"] },
    },
    select: { id: true },
  });

  let scored = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      await scoreAndUpdateLead(lead.id);
      scored++;
    } catch (err) {
      console.error(`Failed to score lead ${lead.id}:`, err);
      failed++;
    }
  }

  revalidatePath("/leads");
  revalidatePath("/reports");
  return { scored, failed, total: leads.length };
}

export async function backfillSubmissionDataEvents() {
  const session = await auth();
  if (!session || !["ADMIN"].includes(session.user.role)) throw new Error("Unauthorized");

  // Find leads with rawPayloadJson but no lead_data_received event
  const leads = await prisma.lead.findMany({
    where: {
      NOT: { rawPayloadJson: { equals: Prisma.DbNull } },
      events: { none: { eventType: "lead_data_received" } },
    },
    select: { id: true, rawPayloadJson: true, source: true },
    take: 500,
  });

  let created = 0;
  for (const lead of leads) {
    const raw = lead.rawPayloadJson as Record<string, unknown> | null;
    if (!raw) continue;
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        eventType: "lead_data_received",
        eventDataJson: JSON.parse(JSON.stringify({
          fields: (raw._rawIntakeForm as Record<string, unknown>) ?? raw,
          metadata: { source: lead.source ?? "unknown" },
        })),
      },
    });
    created++;
  }

  revalidatePath("/leads");
  return { created };
}

export async function getArchivedLeads() {
  const leads = await prisma.lead.findMany({
    where: { status: "ARCHIVED" },
    select: {
      id: true,
      fullName: true,
      companyName: true,
      email: true,
      createdAt: true,
      score: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return leads;
}
