"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { processIngestionItem } from "@/services/ingestion-pipeline.service";
import { revalidatePath } from "next/cache";
import { parseDeviceString, deviceFromUserAgent, geoLabel } from "@/lib/form-device";
import { FORM_STEPS, stepLabel } from "@/lib/form-steps";
import { answerEntries, type AnswerEntry } from "@/lib/form-answers";

/**
 * Who is on the intake form right now.
 *
 * Built on form_sessions, which the form refreshes every fifteen seconds with
 * a ping, so "last seen" is real rather than the moment a partial row happened
 * to be written. Anyone quiet for longer than LIVE_WINDOW has left, and shows
 * in `justLeft` instead. Contact details come from the partial submissions the
 * form saves once someone gets past the contact step, which is what makes
 * calling a visitor mid-form possible.
 */
const LIVE_WINDOW_MS = 90 * 1000;
const JUST_LEFT_MS = 30 * 60 * 1000;

export interface LiveFormSession {
  sessionId: string;
  shortId: string;
  step: string;
  stepLabel: string;
  progressPct: number;
  startedAt: string;
  lastSeenAt: string;
  secondsSinceSeen: number;
  minutesOnForm: number;
  eventCount: number;
  outcome: string;
  reachedContact: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  device: string;
  browser: string;
  os: string;
  location: string | null;
  timezone: string | null;
  ip: string | null;
  ipType: string | null;
  ipIsp: string | null;
  variants: Array<{ key: string; value: string }>;
  source: string | null;
  utm: string | null;
  leadId: string | null;
  /** Everything typed into the form so far, newest snapshot, ready to render. */
  answers: AnswerEntry[];
  answersAt: string | null;
  /** How many times they left the form and came back. */
  returnCount: number;
}

export async function getLiveFormSessions(): Promise<{ live: LiveFormSession[]; justLeft: LiveFormSession[] }> {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const now = Date.now();
  const rows = await prisma.formSession.findMany({
    where: { lastSeenAt: { gte: new Date(now - JUST_LEFT_MS) } },
    orderBy: { lastSeenAt: "desc" },
    take: 60,
    select: {
      sessionId: true, startedAt: true, lastSeenAt: true, furthestStep: true, furthestIndex: true,
      device: true, timezone: true, geoCity: true, geoRegion: true, geoCountry: true, ip: true,
      variantsJson: true, referrer: true, sourcePage: true, utmSource: true, utmMedium: true, utmCampaign: true,
      outcome: true, reachedContact: true, eventCount: true, leadId: true,
      answersJson: true, answersAt: true, returnCount: true, ipType: true, ipIsp: true,
    },
  });
  if (rows.length === 0) return { live: [], justLeft: [] };

  // Contact details for these visitors, newest partial per session.
  const ids = rows.map((r) => r.sessionId);
  const partials = await prisma.ingestionQueue.findMany({
    where: { sessionId: { in: ids } },
    orderBy: { receivedAt: "desc" },
    select: { sessionId: true, rawPayload: true, leadId: true },
  });
  const detailsBySession = new Map<string, { name: string | null; email: string | null; phone: string | null; company: string | null; leadId: string | null }>();
  for (const p of partials) {
    if (!p.sessionId) continue;
    const raw = p.rawPayload as Record<string, unknown> | null;
    const fields = ((raw?.fields ?? raw) ?? {}) as Record<string, unknown>;
    const str = (...keys: string[]): string | null => {
      for (const k of keys) {
        const v = fields[k];
        if (typeof v === "string" && v.trim() !== "") return v.trim();
      }
      return null;
    };
    const prev = detailsBySession.get(p.sessionId);
    detailsBySession.set(p.sessionId, {
      // Newest row wins, but never overwrite a value with a blank one.
      name: prev?.name ?? str("full_name", "fullName", "name"),
      email: prev?.email ?? str("email"),
      phone: prev?.phone ?? str("phone"),
      company: prev?.company ?? str("company_name", "companyName", "company"),
      leadId: prev?.leadId ?? p.leadId ?? null,
    });
  }

  const lastStepIndex = Math.max(1, FORM_STEPS.length - 1);
  const map = (r: (typeof rows)[number]): LiveFormSession => {
    const parts = parseDeviceString(r.device);
    const seen = r.lastSeenAt.getTime();
    const details = detailsBySession.get(r.sessionId);
    // The live snapshot beats the saved partial: it arrives as they type,
    // while a partial is only written once they pass certain steps.
    const answers = answerEntries(r.answersJson);
    const answered = (key: string): string | null => answers.find((a) => a.key === key)?.value ?? null;
    const variantsRaw = (r.variantsJson ?? {}) as Record<string, unknown>;
    const utm = [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(" / ") || null;
    return {
      sessionId: r.sessionId,
      shortId: r.sessionId.slice(0, 8),
      step: r.furthestStep ?? "intro",
      stepLabel: stepLabel(r.furthestStep),
      progressPct: Math.min(100, Math.round((Math.max(0, r.furthestIndex) / lastStepIndex) * 100)),
      startedAt: r.startedAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      secondsSinceSeen: Math.max(0, Math.round((now - seen) / 1000)),
      minutesOnForm: Math.max(0, Math.round((seen - r.startedAt.getTime()) / 60000)),
      eventCount: r.eventCount,
      outcome: r.outcome,
      reachedContact: r.reachedContact,
      name: answered("fullName") ?? details?.name ?? null,
      email: answered("email") ?? details?.email ?? null,
      phone: answered("phone") ?? details?.phone ?? null,
      company: answered("companyName") ?? details?.company ?? null,
      device: parts.device,
      browser: parts.browser,
      os: parts.os,
      location: geoLabel(r.geoCity, r.geoRegion, r.geoCountry),
      timezone: r.timezone,
      ip: r.ip,
      ipType: r.ipType,
      ipIsp: r.ipIsp,
      variants: Object.entries(variantsRaw)
        .filter(([, v]) => typeof v === "string")
        .map(([key, v]) => ({ key, value: String(v) })),
      source: r.referrer ?? r.sourcePage ?? null,
      utm,
      leadId: r.leadId ?? details?.leadId ?? null,
      answers,
      answersAt: r.answersAt?.toISOString() ?? null,
      returnCount: r.returnCount,
    };
  };

  const live: LiveFormSession[] = [];
  const justLeft: LiveFormSession[] = [];
  for (const r of rows) {
    const item = map(r);
    // Someone who submitted is finished, however recently they pinged.
    if (item.secondsSinceSeen * 1000 <= LIVE_WINDOW_MS && r.outcome !== "completed") live.push(item);
    else justLeft.push(item);
  }
  return { live, justLeft: justLeft.slice(0, 12) };
}

/**
 * The last 10 partial form sessions regardless of status. Shown on the Live
 * Monitor when nothing is active so the panel is never just an empty box.
 */
export async function getRecentSessions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const rows = await prisma.ingestionQueue.findMany({
    where: { isPartial: true },
    orderBy: { receivedAt: "desc" },
    take: 10,
    select: {
      id: true,
      sessionId: true,
      status: true,
      partialStep: true,
      rawPayload: true,
      receivedAt: true,
      lastHeartbeatAt: true,
      userAgent: true,
      leadId: true,
    },
  });

  // A partial can become a lead either on its own row or through a later
  // completed submission that shares its session id.
  const sessionIds = rows
    .map((r) => r.sessionId)
    .filter((s): s is string => !!s);
  const linked = sessionIds.length
    ? await prisma.ingestionQueue.findMany({
        where: { sessionId: { in: sessionIds }, leadId: { not: null } },
        select: { sessionId: true, leadId: true },
      })
    : [];
  const leadBySession = new Map<string, string>();
  for (const l of linked) {
    if (l.sessionId && l.leadId && !leadBySession.has(l.sessionId)) {
      leadBySession.set(l.sessionId, l.leadId);
    }
  }

  return rows.map((r) => {
    const raw = r.rawPayload as Record<string, unknown>;
    const fields = (raw?.fields ?? raw) as Record<string, unknown>;
    const lastActive = r.lastHeartbeatAt ?? r.receivedAt;
    return {
      id: r.id,
      sessionId: r.sessionId?.slice(0, 8) ?? "unknown",
      status: r.status,
      name: String(fields?.fullName ?? fields?.full_name ?? fields?.name ?? "") || null,
      email: String(fields?.email ?? "") || null,
      step: r.partialStep ?? "unknown",
      lastActiveAt: new Date(lastActive).toISOString(),
      device: deviceFromUserAgent(r.userAgent).device,
      leadId: r.leadId ?? (r.sessionId ? leadBySession.get(r.sessionId) ?? null : null),
    };
  });
}

export async function getRecentCompletions() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  return prisma.ingestionQueue.findMany({
    where: { status: "completed", isPartial: false, partialStep: null },
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

/**
 * Turn an abandoned session into a lead by hand.
 *
 * The row being clicked is often the "form opened" checkpoint, which holds no
 * fields at all. The pipeline merges everything else the session left behind
 * first, so the lead arrives with the name, contact details and answers the
 * visitor actually gave. Afterwards this marks it as an abandoned-form lead and
 * writes the same explanatory note the scheduled job writes, so a lead made by
 * hand is indistinguishable from one the job made. Recapture emails are not
 * started: somebody promoting a session by hand is about to work it themselves.
 */
export async function promotePartialToLead(
  queueId: string
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role))
    throw new Error("Unauthorized");

  const item = await prisma.ingestionQueue.findUnique({ where: { id: queueId } });
  if (!item) return { success: false, error: "That submission is no longer in the queue." };

  // Already a lead: nothing to create, just point at it.
  if (item.leadId) {
    return { success: true, leadId: item.leadId };
  }

  // Reset so the pipeline picks it up. isPartial goes false so the scheduled
  // job does not process the same row again behind us.
  await prisma.ingestionQueue.update({
    where: { id: queueId },
    data: { status: "received", isPartial: false, errorMessage: null },
  });

  await processIngestionItem(queueId);

  const updated = await prisma.ingestionQueue.findUnique({ where: { id: queueId } });
  if (!updated || updated.status !== "completed" || !updated.leadId) {
    const message = updated?.errorMessage ?? "";
    const reason = /^(Validation failed|Skipped)/.test(message)
      ? "There is no email or phone anywhere in this session, so there is nobody to contact."
      : message || "The pipeline could not create a lead from this session.";
    return { success: false, error: reason };
  }

  const step = (item.partialStep ?? "unknown").replace(/^abandoned_at_/, "");
  await prisma.lead.update({
    where: { id: updated.leadId },
    data: { fromAbandonedForm: true },
  });
  await prisma.leadNote.create({
    data: {
      leadId: updated.leadId,
      userId: session.user.id,
      noteBody: `Created by hand from an abandoned form session. Last step completed: ${step}`,
    },
  });

  revalidatePath("/admin/monitor");
  revalidatePath("/leads");
  return { success: true, leadId: updated.leadId };
}
