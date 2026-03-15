"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { scoreAndUpdateLead } from "@/services/scoring.service";
import type { LeadStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { estStartOfDay, estDateStringToUtcStart, estDateStringToUtcEnd } from "@/lib/timezone";

export async function getLeads(params: {
  search?: string;
  status?: string[];
  qualityTier?: string[];
  state?: string;
  assignedUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  isRead?: string;
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

  // Exclude ARCHIVED leads by default unless explicitly filtering for them
  if (status?.length) {
    where.status = { in: status as LeadStatus[] };
  } else {
    where.status = { notIn: ["ARCHIVED", "MERGED"] };
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (qualityTier?.length) {
    where.qualityTier = { in: qualityTier };
  }

  if (state) {
    where.state = { equals: state, mode: "insensitive" };
  }

  if (assignedUserId) {
    where.assignedUserId = assignedUserId;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = estDateStringToUtcStart(dateFrom);
    if (dateTo) where.createdAt.lte = estDateStringToUtcEnd(dateTo);
  }

  if (isRead === "false") {
    where.isRead = false;
  } else if (isRead === "true") {
    where.isRead = true;
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
    "urgency",
    "serviceRequested",
    "businessType",
  ];

  const orderField = allowedSortFields.includes(sortField)
    ? sortField
    : "createdAt";

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

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: newStatus },
  });

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

export async function assignLead(leadId: string, userId: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedUserId: userId },
  });

  await logEvent(
    leadId,
    "assigned_user_changed",
    { assignedUserId: userId },
    session.user.id
  );

  revalidatePath(`/leads/${leadId}`);
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
    a_leads: () => prisma.lead.count({ where: { qualityTier: { contains: "A", mode: "insensitive" }, ...notArchived } }),
    b_leads: () => prisma.lead.count({ where: { qualityTier: { contains: "B", mode: "insensitive" }, ...notArchived } }),
    c_leads: () => prisma.lead.count({ where: { qualityTier: { contains: "C", mode: "insensitive" }, ...notArchived } }),
    poor_leads: () => prisma.lead.count({ where: { qualityTier: { contains: "Poor", mode: "insensitive" }, ...notArchived } }),
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
