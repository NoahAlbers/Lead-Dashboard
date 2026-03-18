import { prisma } from "@/lib/db";
import { createNotificationsForRole } from "@/services/notification.service";

export async function runReconciliation(): Promise<{
  submissionsReceived: number;
  leadsCreated: number;
  duplicates: number;
  failures: number;
  partials: number;
  discrepancy: boolean;
}> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const periodEnd = now;

  try {
    // Count submissions in last 24h (non-partial only)
    const submissions = await prisma.ingestionQueue.findMany({
      where: { receivedAt: { gte: periodStart, lte: periodEnd }, isPartial: false },
    });

    const submissionsReceived = submissions.length;
    const completed = submissions.filter((s) => s.status === "completed").length;
    const duplicates = submissions.filter((s) => s.status === "duplicate").length;
    const failures = submissions.filter((s) => s.status === "failed").length;
    const stuck = submissions.filter(
      (s) =>
        (s.status === "received" || s.status === "processing") &&
        s.receivedAt.getTime() < now.getTime() - 10 * 60 * 1000 // >10 min old
    );

    // Retry stuck items
    for (const item of stuck) {
      try {
        await prisma.ingestionQueue.update({
          where: { id: item.id },
          data: { status: "received", retryCount: { increment: 1 } },
        });
        const { processIngestionItem } = await import(
          "@/services/ingestion-pipeline.service"
        );
        await processIngestionItem(item.id).catch(() => {});
      } catch {
        // Don't fail reconciliation if a single retry fails
      }
    }

    // Count partials
    const partials = await prisma.ingestionQueue.count({
      where: { receivedAt: { gte: periodStart, lte: periodEnd }, isPartial: true },
    });

    // Count leads created in same period
    const leadsCreated = await prisma.lead.count({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
    });

    // Check discrepancy: completed should roughly match leadsCreated
    // (allow some slack for leads from other sources)
    const discrepancy = completed > leadsCreated + duplicates;

    // Log
    await prisma.reconciliationLog.create({
      data: {
        periodStart,
        periodEnd,
        submissionsReceived,
        leadsCreated,
        duplicates,
        failures,
        partials,
        discrepancy,
        details: { stuck: stuck.length, retried: stuck.length },
      },
    });

    // Alert on discrepancy
    if (discrepancy) {
      await createNotificationsForRole(
        "ADMIN",
        "system_alert",
        "Lead Ingestion Discrepancy",
        `${submissionsReceived} submissions received but only ${leadsCreated} leads created in last 24h. ${failures} failures, ${duplicates} duplicates.`,
        null,
        "CRITICAL"
      ).catch(() => {});
    }

    return {
      submissionsReceived,
      leadsCreated,
      duplicates,
      failures,
      partials,
      discrepancy,
    };
  } catch (error) {
    console.error("Reconciliation failed:", error);
    throw error;
  }
}
