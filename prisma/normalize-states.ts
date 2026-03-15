import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// State abbreviation to full name map
const STATE_MAP: Record<string, string> = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
  "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
  "DC": "Washington DC", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
  "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine",
  "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
  "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
  "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
  "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
  "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
  "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
  "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
};

function normalizeState(input: string): string {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (STATE_MAP[upper]) return STATE_MAP[upper];
  // Already a full name? Return as-is
  const lower = trimmed.toLowerCase();
  for (const name of Object.values(STATE_MAP)) {
    if (name.toLowerCase() === lower) return name;
  }
  return trimmed;
}

async function main() {
  const leads = await prisma.lead.findMany({
    where: { state: { not: null } },
    select: { id: true, state: true },
  });

  let updated = 0;
  for (const lead of leads) {
    if (!lead.state) continue;
    const normalized = normalizeState(lead.state);
    if (normalized !== lead.state) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { state: normalized },
      });
      console.log(`  ${lead.state} → ${normalized}`);
      updated++;
    }
  }

  console.log(`Normalized ${updated} of ${leads.length} leads`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
