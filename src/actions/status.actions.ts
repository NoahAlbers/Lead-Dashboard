"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { scoreAndUpdateLead } from "@/services/scoring.service";

export async function getCustomStatuses(type?: string) {
  const where = type ? { type } : {};
  return prisma.customStatus.findMany({
    where,
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCustomStatus(data: {
  name: string;
  color: string;
  type: string;
}) {
  const maxOrder = await prisma.customStatus.aggregate({
    where: { type: data.type },
    _max: { sortOrder: true },
  });

  await prisma.customStatus.create({
    data: {
      name: data.name,
      color: data.color,
      type: data.type,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin/settings");
}

export async function updateCustomStatus(
  id: string,
  data: { name?: string; color?: string; sortOrder?: number }
) {
  await prisma.customStatus.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/settings");
}

export async function deleteCustomStatus(id: string) {
  await prisma.customStatus.delete({
    where: { id },
  });

  revalidatePath("/admin/settings");
}

// Tier ranges are stored as a JSON string in a special CustomStatus record
const TIER_RANGES_ID = "system-tier-ranges";

export async function getTierRanges() {
  const record = await prisma.customStatus.findUnique({
    where: { id: TIER_RANGES_ID },
  });

  if (!record) {
    // Return defaults
    return [
      { tier: "A", label: "A Lead", min: 80, max: 100, color: "#B3E8D4" },
      { tier: "B", label: "B Lead", min: 60, max: 79, color: "#B3D4FF" },
      { tier: "C", label: "C Lead", min: 40, max: 59, color: "#FFF3B3" },
      { tier: "POOR", label: "Poor Fit", min: 0, max: 39, color: "#FFB3B3" },
    ];
  }

  try {
    return JSON.parse(record.color); // We store the JSON in the color field for simplicity
  } catch {
    return [
      { tier: "A", label: "A Lead", min: 80, max: 100, color: "#B3E8D4" },
      { tier: "B", label: "B Lead", min: 60, max: 79, color: "#B3D4FF" },
      { tier: "C", label: "C Lead", min: 40, max: 59, color: "#FFF3B3" },
      { tier: "POOR", label: "Poor Fit", min: 0, max: 39, color: "#FFB3B3" },
    ];
  }
}

export async function saveTierRanges(
  ranges: Array<{ tier: string; min: number; max: number }>
) {
  const fullRanges = ranges.map((r) => {
    const labels: Record<string, string> = { A: "A Lead", B: "B Lead", C: "C Lead", POOR: "Poor Fit" };
    const colors: Record<string, string> = { A: "#B3E8D4", B: "#B3D4FF", C: "#FFF3B3", POOR: "#FFB3B3" };
    return {
      tier: r.tier,
      label: labels[r.tier] ?? r.tier,
      min: r.min,
      max: r.max,
      color: colors[r.tier] ?? "#D4D4D4",
    };
  });

  await prisma.customStatus.upsert({
    where: { id: TIER_RANGES_ID },
    update: { color: JSON.stringify(fullRanges) },
    create: {
      id: TIER_RANGES_ID,
      name: "Tier Ranges Config",
      color: JSON.stringify(fullRanges),
      type: "config",
      sortOrder: 0,
      isDefault: true,
    },
  });

  // Recalculate all leads with new tier boundaries
  const leads = await prisma.lead.findMany({
    where: { status: { notIn: ["ARCHIVED", "DISQUALIFIED"] } },
    select: { id: true },
  });

  for (const lead of leads) {
    await scoreAndUpdateLead(lead.id);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/leads");
}
