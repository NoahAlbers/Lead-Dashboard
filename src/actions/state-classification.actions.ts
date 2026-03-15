"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const ALL_STATES: { abbrev: string; name: string }[] = [
  { abbrev: "AL", name: "Alabama" }, { abbrev: "AK", name: "Alaska" },
  { abbrev: "AZ", name: "Arizona" }, { abbrev: "AR", name: "Arkansas" },
  { abbrev: "CA", name: "California" }, { abbrev: "CO", name: "Colorado" },
  { abbrev: "CT", name: "Connecticut" }, { abbrev: "DE", name: "Delaware" },
  { abbrev: "DC", name: "District of Columbia" }, { abbrev: "FL", name: "Florida" },
  { abbrev: "GA", name: "Georgia" }, { abbrev: "HI", name: "Hawaii" },
  { abbrev: "ID", name: "Idaho" }, { abbrev: "IL", name: "Illinois" },
  { abbrev: "IN", name: "Indiana" }, { abbrev: "IA", name: "Iowa" },
  { abbrev: "KS", name: "Kansas" }, { abbrev: "KY", name: "Kentucky" },
  { abbrev: "LA", name: "Louisiana" }, { abbrev: "ME", name: "Maine" },
  { abbrev: "MD", name: "Maryland" }, { abbrev: "MA", name: "Massachusetts" },
  { abbrev: "MI", name: "Michigan" }, { abbrev: "MN", name: "Minnesota" },
  { abbrev: "MS", name: "Mississippi" }, { abbrev: "MO", name: "Missouri" },
  { abbrev: "MT", name: "Montana" }, { abbrev: "NE", name: "Nebraska" },
  { abbrev: "NV", name: "Nevada" }, { abbrev: "NH", name: "New Hampshire" },
  { abbrev: "NJ", name: "New Jersey" }, { abbrev: "NM", name: "New Mexico" },
  { abbrev: "NY", name: "New York" }, { abbrev: "NC", name: "North Carolina" },
  { abbrev: "ND", name: "North Dakota" }, { abbrev: "OH", name: "Ohio" },
  { abbrev: "OK", name: "Oklahoma" }, { abbrev: "OR", name: "Oregon" },
  { abbrev: "PA", name: "Pennsylvania" }, { abbrev: "RI", name: "Rhode Island" },
  { abbrev: "SC", name: "South Carolina" }, { abbrev: "SD", name: "South Dakota" },
  { abbrev: "TN", name: "Tennessee" }, { abbrev: "TX", name: "Texas" },
  { abbrev: "UT", name: "Utah" }, { abbrev: "VT", name: "Vermont" },
  { abbrev: "VA", name: "Virginia" }, { abbrev: "WA", name: "Washington" },
  { abbrev: "WV", name: "West Virginia" }, { abbrev: "WI", name: "Wisconsin" },
  { abbrev: "WY", name: "Wyoming" },
];

// Default classifications — good = can collect, banned = cannot collect/solicit
const DEFAULT_GOOD_STATES = [
  "FL", "GA", "AL", "MS", "TN", "NC", "SC", "VA", "TX", "OH",
  "PA", "IN", "KY", "MO", "OK", "AR", "LA", "WI", "MN", "IA",
  "KS", "NE", "SD", "ND", "MT", "WY", "ID", "AZ", "NM", "UT",
  "CO", "NV", "HI", "AK", "ME", "NH", "VT", "DE", "WV", "RI",
];

const DEFAULT_BANNED_STATES = [
  "CA", "NY", "MA", "CT", "NJ", "MD", "IL", "WA", "OR", "MI", "DC",
];

export async function getStateClassifications() {
  let states = await prisma.stateClassification.findMany({
    orderBy: { stateAbbrev: "asc" },
  });

  // Auto-seed if empty
  if (states.length === 0) {
    await seedStateClassifications();
    states = await prisma.stateClassification.findMany({
      orderBy: { stateAbbrev: "asc" },
    });
  }

  return states;
}

export async function seedStateClassifications() {
  const existing = await prisma.stateClassification.count();
  if (existing > 0) return;

  await prisma.stateClassification.createMany({
    data: ALL_STATES.map((s) => ({
      stateAbbrev: s.abbrev,
      stateName: s.name,
      classification: DEFAULT_GOOD_STATES.includes(s.abbrev)
        ? "good"
        : DEFAULT_BANNED_STATES.includes(s.abbrev)
        ? "banned"
        : "unknown",
      active: true,
    })),
  });
}

export async function updateStateClassification(
  id: string,
  data: { classification?: string; note?: string }
) {
  await prisma.stateClassification.update({
    where: { id },
    data,
  });
  revalidatePath("/admin/settings");
}

export async function bulkUpdateClassification(
  stateAbbrevs: string[],
  classification: string
) {
  await prisma.stateClassification.updateMany({
    where: { stateAbbrev: { in: stateAbbrevs } },
    data: { classification },
  });
  revalidatePath("/admin/settings");
}

export async function getStateClassificationMap(): Promise<Record<string, string>> {
  const states = await getStateClassifications();
  const map: Record<string, string> = {};
  for (const s of states) {
    map[s.stateAbbrev.toUpperCase()] = s.classification;
  }
  return map;
}
