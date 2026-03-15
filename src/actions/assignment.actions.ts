"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface WorkloadStat {
  userId: string;
  userName: string;
  userRole: string;
  total: number;
  byStatus: Record<string, number>;
  slaBreached: number;
}

export async function getWorkloadStats(): Promise<WorkloadStat[]> {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const stats: WorkloadStat[] = [];

  for (const user of users) {
    const leads = await prisma.lead.findMany({
      where: {
        assignedUserId: user.id,
        status: { notIn: ["ARCHIVED", "MERGED", "WON", "LOST", "DISQUALIFIED"] },
      },
      select: { status: true, slaStatus: true },
    });

    const byStatus: Record<string, number> = {};
    let slaBreached = 0;

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
      if (lead.slaStatus === "breached" || lead.slaStatus === "escalated") {
        slaBreached++;
      }
    }

    stats.push({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      total: leads.length,
      byStatus,
      slaBreached,
    });
  }

  return stats;
}

export async function getUnassignedLeadCount(): Promise<number> {
  return prisma.lead.count({
    where: {
      assignedUserId: null,
      status: { notIn: ["ARCHIVED", "MERGED", "WON", "LOST", "DISQUALIFIED", "DUPLICATE"] },
    },
  });
}

export async function getLeadsForUser(userId: string) {
  return prisma.lead.findMany({
    where: {
      assignedUserId: userId,
      status: { notIn: ["ARCHIVED", "MERGED", "WON", "LOST", "DISQUALIFIED"] },
    },
    select: {
      id: true,
      companyName: true,
      fullName: true,
      score: true,
      qualityTier: true,
      status: true,
      state: true,
      slaStatus: true,
      createdAt: true,
    },
    orderBy: [
      { slaStatus: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });
}

export async function getActiveUsers() {
  const session = await auth();
  if (!session) return [];
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}
