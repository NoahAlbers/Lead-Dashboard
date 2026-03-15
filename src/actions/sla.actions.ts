"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { computeLeadSla, type SlaInfo } from "@/services/sla.service";

// --- SLA Config CRUD ---

export async function getSlaConfigs() {
  return prisma.slaConfig.findMany({ orderBy: { qualityTier: "asc" } });
}

export async function upsertSlaConfig(
  qualityTier: string,
  data: { firstContactMinutes: number; followUpMinutes: number; escalationMinutes: number | null }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.slaConfig.upsert({
    where: { qualityTier },
    update: {
      firstContactMinutes: data.firstContactMinutes,
      followUpMinutes: data.followUpMinutes,
      escalationMinutes: data.escalationMinutes,
    },
    create: {
      qualityTier,
      firstContactMinutes: data.firstContactMinutes,
      followUpMinutes: data.followUpMinutes,
      escalationMinutes: data.escalationMinutes,
    },
  });

  revalidatePath("/admin/settings");
}

// --- Office Hours CRUD ---

export async function getOfficeHours() {
  const config = await prisma.officeHoursConfig.findFirst();
  return config ?? {
    id: "",
    startTime: "09:00",
    endTime: "16:00",
    activeDays: [1, 2, 3, 4, 5],
    timezone: "America/New_York",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateOfficeHours(data: {
  startTime: string;
  endTime: string;
  activeDays: number[];
  timezone: string;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const existing = await prisma.officeHoursConfig.findFirst();
  if (existing) {
    await prisma.officeHoursConfig.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.officeHoursConfig.create({ data });
  }

  revalidatePath("/admin/settings");
}

// --- Holidays CRUD ---

export async function getHolidays() {
  return prisma.officeHoursHoliday.findMany({ orderBy: { date: "asc" } });
}

export async function addHoliday(date: string, name: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.officeHoursHoliday.create({
    data: { date: new Date(date), name },
  });

  revalidatePath("/admin/settings");
}

export async function removeHoliday(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.officeHoursHoliday.delete({ where: { id } });
  revalidatePath("/admin/settings");
}

export async function importFederalHolidays(year: number) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const holidays = [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-01-20`, name: "MLK Day" }, // approximate
    { date: `${year}-02-17`, name: "Presidents' Day" }, // approximate
    { date: `${year}-05-26`, name: "Memorial Day" }, // approximate
    { date: `${year}-06-19`, name: "Juneteenth" },
    { date: `${year}-07-04`, name: "Independence Day" },
    { date: `${year}-09-01`, name: "Labor Day" }, // approximate
    { date: `${year}-11-11`, name: "Veterans Day" },
    { date: `${year}-11-27`, name: "Thanksgiving" }, // approximate
    { date: `${year}-12-25`, name: "Christmas" },
  ];

  for (const h of holidays) {
    await prisma.officeHoursHoliday.create({
      data: { date: new Date(h.date), name: h.name },
    }).catch(() => {}); // Skip duplicates
  }

  revalidatePath("/admin/settings");
}

// --- Lead SLA Info ---

export async function getLeadSlaInfo(leadId: string): Promise<SlaInfo | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  return computeLeadSla(lead);
}
