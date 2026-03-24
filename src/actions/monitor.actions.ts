"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { processIngestionItem } from "@/services/ingestion-pipeline.service";
import { revalidatePath } from "next/cache";

export async function getActiveSessions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

  const sessions = await prisma.ingestionQueue.findMany({
    where: {
      isPartial: true,
      status: "partial",
      receivedAt: { gte: fifteenMinAgo },
    },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      sessionId: true,
      partialStep: true,
      rawPayload: true,
      receivedAt: true,
      lastHeartbeatAt: true,
      formOpenedAt: true,
      sourceIp: true,
      userAgent: true,
    },
  });

  return sessions.map((s) => {
    const raw = s.rawPayload as Record<string, unknown>;
    const fields = (raw?.fields ?? raw) as Record<string, unknown>;
    const lastActive = s.lastHeartbeatAt ?? s.receivedAt;
    const minutesSinceActive =
      (Date.now() - new Date(lastActive).getTime()) / 60000;

    return {
      id: s.id,
      sessionId: s.sessionId?.slice(0, 8) ?? "unknown",
      name: String(
        fields?.fullName ?? fields?.full_name ?? fields?.name ?? "\u2014"
      ),
      company: String(
        fields?.companyName ??
          fields?.company_name ??
          fields?.company ??
          "\u2014"
      ),
      email: String(fields?.email ?? "\u2014"),
      currentStep: s.partialStep ?? "unknown",
      timeOnForm: Math.round(
        (Date.now() -
          new Date(s.formOpenedAt ?? s.receivedAt).getTime()) /
          60000
      ),
      startedAt: (s.formOpenedAt ?? s.receivedAt).toISOString(),
      status:
        minutesSinceActive < 2
          ? ("active" as const)
          : minutesSinceActive < 5
            ? ("idle" as const)
            : ("abandoned" as const),
    };
  });
}

export async function getRecentCompletions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  return prisma.ingestionQueue.findMany({
    where: { status: "completed", isPartial: false },
    orderBy: { processedAt: "desc" },
    take: 20,
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          fullName: true,
          score: true,
          qualityTier: true,
        },
      },
    },
  });
}

export async function getAbandonedSessions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return prisma.ingestionQueue.findMany({
    where: {
      isPartial: true,
      status: "partial",
      receivedAt: { lt: fifteenMinAgo, gte: twentyFourHoursAgo },
    },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
}

export async function getConnectionHealth() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [queueDepth, lastSubmission, failedCount, allRecent] =
    await Promise.all([
      prisma.ingestionQueue.count({
        where: { status: { in: ["received", "processing"] } },
      }),
      prisma.ingestionQueue.findFirst({
        where: { isPartial: false },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
      }),
      prisma.ingestionQueue.count({
        where: { status: "failed", receivedAt: { gte: h24 } },
      }),
      prisma.ingestionQueue.count({
        where: { receivedAt: { gte: h24 }, isPartial: false },
      }),
    ]);

  const completedRecent = await prisma.ingestionQueue.count({
    where: {
      status: "completed",
      isPartial: false,
      receivedAt: { gte: h24 },
    },
  });

  const [clientFailureCount, authSuspectCount] = await Promise.all([
    prisma.ingestionQueue.count({
      where: { status: "client_failure", receivedAt: { gte: h24 } },
    }),
    prisma.ingestionQueue.count({
      where: { status: "auth_suspect", receivedAt: { gte: h24 } },
    }),
  ]);

  return {
    queueDepth,
    lastSubmission: lastSubmission?.receivedAt?.toISOString() ?? null,
    failedCount,
    processingRate: completedRecent,
    totalRecent: allRecent,
    clientFailureCount,
    authSuspectCount,
  };
}

export async function getClientReportedFailures() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const items = await prisma.ingestionQueue.findMany({
    where: { status: "client_failure", receivedAt: { gte: h24 } },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      submissionId: true,
      sessionId: true,
      errorMessage: true,
      rawPayload: true,
      receivedAt: true,
      sourceIp: true,
    },
  });

  return items.map((item) => {
    const raw = item.rawPayload as Record<string, unknown>;
    const summary = (raw?.form_data_summary ?? {}) as Record<string, unknown>;
    return {
      id: item.id,
      submissionId: item.submissionId,
      sessionId: item.sessionId?.slice(0, 8) ?? "unknown",
      errorMessage: item.errorMessage ?? "Unknown error",
      name: String(summary.name ?? "—"),
      email: String(summary.email ?? "—"),
      phone: String(summary.phone ?? "—"),
      receivedAt: item.receivedAt.toISOString(),
      sourceIp: item.sourceIp,
    };
  });
}

export async function getAuthSuspectSubmissions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return prisma.ingestionQueue.findMany({
    where: { status: "auth_suspect", receivedAt: { gte: h24 } },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      submissionId: true,
      sourceIp: true,
      receivedAt: true,
      receiptId: true,
    },
  });
}

export async function processAuthSuspectItem(queueId: string) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  await prisma.ingestionQueue.update({
    where: { id: queueId },
    data: { status: "received" },
  });

  await processIngestionItem(queueId);
  revalidatePath("/admin/monitor");
}

export async function promotePartialToLead(queueId: string) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  // Reset the partial to "received" status so the pipeline processes it
  await prisma.ingestionQueue.update({
    where: { id: queueId },
    data: { status: "received", isPartial: false },
  });

  await processIngestionItem(queueId);
  revalidatePath("/admin/monitor");
}
