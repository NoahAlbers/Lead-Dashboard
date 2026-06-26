import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * One-time backfill of the derived numeric columns added for advanced filtering:
 *  - accountVolumeNum: parsed from the existing `accountVolume` string (units).
 *  - avgRentNum:       parsed from rawPayloadJson._rawIntakeForm.avgRent.
 * Non-numeric / missing sources are left null (so they're cleanly excluded from
 * numeric range filters rather than treated as 0). Idempotent: only fills rows
 * where the target column is still null.
 *
 * Run: npx tsx prisma/backfill-numeric-fields.ts
 */
async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      accountVolume: true,
      accountVolumeNum: true,
      avgRentNum: true,
      rawPayloadJson: true,
    },
  });

  let updated = 0;
  for (const lead of leads) {
    const data: { accountVolumeNum?: number | null; avgRentNum?: number | null } = {};

    if (lead.accountVolumeNum == null && lead.accountVolume != null) {
      const n = parseInt(String(lead.accountVolume).replace(/[^0-9-]/g, ""), 10);
      if (!Number.isNaN(n)) data.accountVolumeNum = n;
    }

    if (lead.avgRentNum == null) {
      const raw = lead.rawPayloadJson as Record<string, unknown> | null;
      const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw ?? {};
      const avgRent = intake?.avgRent;
      const n =
        typeof avgRent === "number"
          ? avgRent
          : avgRent != null
            ? parseFloat(String(avgRent).replace(/[^0-9.-]/g, ""))
            : NaN;
      if (!Number.isNaN(n)) data.avgRentNum = Math.round(n);
    }

    if (Object.keys(data).length > 0) {
      await prisma.lead.update({ where: { id: lead.id }, data });
      console.log(
        `  ${lead.id}: ${Object.entries(data)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      );
      updated++;
    }
  }

  console.log(`Backfilled numeric fields for ${updated} of ${leads.length} leads`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
