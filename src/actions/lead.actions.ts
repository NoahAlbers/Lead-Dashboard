"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logEvent } from "@/services/activity-log.service";
import { scoreAndUpdateLead } from "@/services/scoring.service";
import type { LeadStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getLeads(params: {
  search?: string;
  status?: string[];
  qualityTier?: string[];
  state?: string;
  assignedUserId?: string;
  dateFrom?: string;
  dateTo?: string;
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
    where.status = { not: "ARCHIVED" };
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
    where.qualityTier = { in: qualityTier as ("A" | "B" | "C" | "POOR")[] };
  }

  if (state) {
    where.state = { equals: state, mode: "insensitive" };
  }

  if (assignedUserId) {
    where.assignedUserId = assignedUserId;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
  }

  const allowedSortFields = [
    "createdAt",
    "companyName",
    "fullName",
    "email",
    "state",
    "score",
    "status",
    "qualityTier",
    "lastActivityAt",
    "balanceAmount",
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    newToday,
    uncontacted,
    highQuality,
    followUpNeeded,
    total,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: today }, status: "NEW" } }),
    prisma.lead.count({ where: { status: { in: ["NEW", "REVIEWED"] } } }),
    prisma.lead.count({ where: { qualityTier: "A", status: { not: "ARCHIVED" } } }),
    prisma.lead.count({ where: { status: "FOLLOW_UP_NEEDED" } }),
    prisma.lead.count({ where: { status: { not: "ARCHIVED" } } }),
  ]);

  return {
    newToday,
    uncontacted,
    highQuality,
    followUpNeeded,
    total,
  };
}

export async function markLeadAsRead(leadId: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { isRead: true },
  });
  revalidatePath("/leads");
}

export async function getUnreadCount() {
  return prisma.lead.count({
    where: { isRead: false, status: { not: "ARCHIVED" } },
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
