"use server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getIngestionStats() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [queueDepth, recent, lastRecon] = await Promise.all([
    prisma.ingestionQueue.count({
      where: { status: { in: ["received", "processing"] } },
    }),
    prisma.ingestionQueue.findMany({
      where: { receivedAt: { gte: h24 } },
    }),
    prisma.reconciliationLog.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  // Compute stats from recent items
  // Abandoned partials converted by the cron keep their partialStep; they are
  // not real-time submissions and would skew every number below.
  const isDirect = (r: { isPartial: boolean; partialStep: string | null }) => !r.isPartial && !r.partialStep;
  const received = recent.filter(isDirect).length;
  const completed = recent.filter(
    (r) => r.status === "completed" && isDirect(r)
  ).length;
  const failed = recent.filter((r) => r.status === "failed").length;
  const partial = recent.filter((r) => r.isPartial).length;
  const duplicateCount = recent.filter((r) => r.status === "duplicate").length;
  const successRate =
    received > 0 ? Math.round((completed / received) * 100) : 100;

  // Avg processing time
  const completedItems = recent.filter(
    (r) => r.status === "completed" && r.processedAt && isDirect(r)
  );
  const avgMs =
    completedItems.length > 0
      ? completedItems.reduce(
          (sum, r) =>
            sum + (r.processedAt!.getTime() - r.receivedAt.getTime()),
          0
        ) / completedItems.length
      : 0;

  return {
    queueDepth,
    last24h: {
      received,
      completed,
      failed,
      partial,
      duplicates: duplicateCount,
    },
    successRate,
    avgProcessingTimeMs: Math.round(avgMs),
    lastReconciliation: lastRecon
      ? {
          createdAt: lastRecon.createdAt.toISOString(),
          discrepancy: lastRecon.discrepancy,
          submissionsReceived: lastRecon.submissionsReceived,
          leadsCreated: lastRecon.leadsCreated,
        }
      : null,
  };
}

export async function getFailedSubmissions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return prisma.ingestionQueue.findMany({
    where: { status: "failed" },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      submissionId: true,
      receiptId: true,
      errorMessage: true,
      retryCount: true,
      receivedAt: true,
      sourceIp: true,
      formVersion: true,
    },
  });
}

export async function retryIngestionItem(id: string) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  await prisma.ingestionQueue.update({
    where: { id },
    data: { status: "received" },
  });

  const { processIngestionItem } = await import(
    "@/services/ingestion-pipeline.service"
  );
  await processIngestionItem(id);
  revalidatePath("/admin/settings");
}

export async function getIngestionTimeline() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  // Last 7 days, grouped by date
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const items = await prisma.ingestionQueue.findMany({
    where: { receivedAt: { gte: sevenDaysAgo }, isPartial: false },
    select: { receivedAt: true, status: true },
    orderBy: { receivedAt: "asc" },
  });

  // Group by date
  const byDate: Record<string, number> = {};
  for (const item of items) {
    const date = item.receivedAt.toISOString().split("T")[0];
    byDate[date] = (byDate[date] ?? 0) + 1;
  }

  return Object.entries(byDate).map(([date, count]) => ({ date, count }));
}

export async function runReconciliationNow() {
  const session = await auth();
  if (!session || !["ADMIN"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const { runReconciliation } = await import(
    "@/services/reconciliation.service"
  );
  const result = await runReconciliation();
  revalidatePath("/admin/settings");
  return result;
}
