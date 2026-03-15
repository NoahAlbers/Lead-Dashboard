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

// Tier ranges stored as JSON in a special CustomStatus record
const TIER_RANGES_ID = "system-tier-ranges";

interface TierItem {
  id: string;
  name: string;
  color: string;
  min: number;
  max: number;
}

const DEFAULT_TIERS: TierItem[] = [
  { id: "tier-a", name: "A Lead", color: "#B3E8D4", min: 80, max: 100 },
  { id: "tier-b", name: "B Lead", color: "#B3D4FF", min: 60, max: 79 },
  { id: "tier-c", name: "C Lead", color: "#FFF3B3", min: 40, max: 59 },
  { id: "tier-poor", name: "Poor Fit", color: "#FFB3B3", min: 0, max: 39 },
];

export async function getTierRanges(): Promise<TierItem[]> {
  const record = await prisma.customStatus.findUnique({
    where: { id: TIER_RANGES_ID },
  });

  if (!record) return DEFAULT_TIERS;

  try {
    const parsed = JSON.parse(record.color);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
      return parsed;
    }
    // Legacy format without id — migrate
    return parsed.map((r: { tier?: string; name?: string; label?: string; color?: string; min: number; max: number }, i: number) => ({
      id: r.tier ?? `tier-${i}`,
      name: r.name ?? r.label ?? r.tier ?? `Tier ${i}`,
      color: r.color ?? DEFAULT_TIERS[i]?.color ?? "#D4D4D4",
      min: r.min,
      max: r.max,
    }));
  } catch {
    return DEFAULT_TIERS;
  }
}

export async function getTierColorMap(): Promise<Record<string, string>> {
  const tiers = await getTierRanges();
  const map: Record<string, string> = {};
  for (const t of tiers) {
    map[t.name] = t.color;
  }
  return map;
}

export async function saveTierRanges(tiers: TierItem[]) {
  await prisma.customStatus.upsert({
    where: { id: TIER_RANGES_ID },
    update: { color: JSON.stringify(tiers) },
    create: {
      id: TIER_RANGES_ID,
      name: "Tier Ranges Config",
      color: JSON.stringify(tiers),
      type: "config",
      sortOrder: 0,
      isDefault: true,
    },
  });

  // Recalculate all active leads
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
