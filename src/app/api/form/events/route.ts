import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formCorsHeaders, formPreflight } from "@/lib/form-cors";
import { serverGeoFromHeaders } from "@/lib/request-geo";
import { logger } from "@/lib/logger";

// Batched flow events from the intake form. Creates or updates the visitor's
// form session and appends the events. Never rejects a well-formed batch for
// auth reasons alone (the form key is checked, but a bad key only marks the
// batch untrusted and drops it silently) so a misconfigured key can't 401-spam
// the browser console.

const STEP_ORDER: Record<string, number> = {};
[
  "intro","name","company","website","certify","contact","priorAgency","debtTypes","debtsNow","sellAcbPitch",
  "nonResBranch","sellDedicatedTeam","states","nonResStates","sellContingency","ownership","sellSkipTrace","units",
  "sellRecoverableInsight","sellBigPortfolio","sellUsStaff","rentalTypes","propertyTypes","avgRent","sellTeamExtension","listings",
  "pmSoftware","sellReporting","sellStrategy","comments","done",
].forEach((s, i) => { STEP_ORDER[s] = i; });

interface IncomingEvent { type?: string; step?: string | null; at?: string; elapsed_ms?: number; meta?: Record<string, unknown> | null }

export async function OPTIONS(req: NextRequest) {
  return formPreflight(req);
}

export async function POST(req: NextRequest) {
  const headers = formCorsHeaders(req.headers.get("origin"));
  let body: { session_id?: string; form_version?: string; context?: Record<string, unknown>; events?: IncomingEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers });
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 120) : "";
  const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
  // Pings only say "still here" for the live monitor. They refresh the
  // session's last-seen stamp and are never stored, so a long visit doesn't
  // write an event row every fifteen seconds.
  const storedEvents = events.filter((e) => e.type !== "ping");
  if (!sessionId || events.length === 0) return NextResponse.json({ ok: true, stored: 0 }, { headers });

  const formKey = req.headers.get("x-acb-form-key");
  const keyRow = await prisma.systemConfig.findUnique({ where: { key: "ingestion_form_key" } });
  if (keyRow?.value && formKey !== keyRow.value) {
    logger.warn("FORM_EVENTS", "Bad form key, batch dropped", { sessionId });
    return NextResponse.json({ ok: true, stored: 0 }, { headers });
  }

  const ctx = body.context ?? {};
  const geo = serverGeoFromHeaders(req.headers);
  const utm = (ctx.utm ?? {}) as Record<string, string | undefined>;
  const variants = (ctx.variants && typeof ctx.variants === "object") ? (ctx.variants as Record<string, string>) : null;

  // Furthest step reached in this batch
  let furthestStep: string | null = null;
  let furthestIndex = -1;
  let reachedContact = false;
  let outcome: string | null = null;
  for (const e of events) {
    const step = typeof e.step === "string" ? e.step : null;
    if (e.type === "ping") {
      // A ping carries the step the visitor is sitting on; treat it as reach
      // so the live view keeps up between step changes.
      if (step && (STEP_ORDER[step] ?? -1) > furthestIndex) { furthestIndex = STEP_ORDER[step]; furthestStep = step; }
      continue;
    }
    if (step && (e.type === "step_enter" || e.type === "pitch_view")) {
      const idx = STEP_ORDER[step] ?? -1;
      if (idx > furthestIndex) { furthestIndex = idx; furthestStep = step; }
      if (STEP_ORDER[step] > STEP_ORDER["contact"]) reachedContact = true;
    }
    if (e.type === "submit") outcome = "completed";
    else if (e.type === "abandon" && outcome !== "completed") outcome = "abandoned";
  }

  const existing = await prisma.formSession.findUnique({ where: { sessionId } });
  const data = {
    lastSeenAt: new Date(),
    formVersion: typeof body.form_version === "string" ? body.form_version : existing?.formVersion ?? null,
    variantsJson: variants ?? existing?.variantsJson ?? undefined,
    utmSource: utm.utm_source ?? existing?.utmSource ?? null,
    utmMedium: utm.utm_medium ?? existing?.utmMedium ?? null,
    utmCampaign: utm.utm_campaign ?? existing?.utmCampaign ?? null,
    referrer: typeof ctx.referrer === "string" ? ctx.referrer.slice(0, 500) : existing?.referrer ?? null,
    sourcePage: typeof ctx.source_page === "string" ? ctx.source_page.slice(0, 500) : existing?.sourcePage ?? null,
    device: typeof ctx.device === "string" ? ctx.device.slice(0, 120) : existing?.device ?? null,
    timezone: (typeof ctx.timezone === "string" && ctx.timezone.slice(0, 60)) || geo?.timezone || existing?.timezone || null,
    geoCity: geo?.city ?? existing?.geoCity ?? null,
    geoRegion: geo?.region ?? existing?.geoRegion ?? null,
    geoCountry: geo?.country ?? existing?.geoCountry ?? null,
    ip: geo?.ip ?? existing?.ip ?? null,
    ...(furthestIndex > (existing?.furthestIndex ?? -1) ? { furthestStep, furthestIndex } : {}),
    ...(reachedContact ? { reachedContact: true } : {}),
    // Completed sticks; abandoned only if not already completed.
    ...(outcome === "completed" ? { outcome: "completed" } : outcome === "abandoned" && existing?.outcome !== "completed" ? { outcome: "abandoned" } : {}),
    eventCount: { increment: storedEvents.length },
  };

  await prisma.formSession.upsert({
    where: { sessionId },
    create: { sessionId, ...data, eventCount: storedEvents.length, furthestStep: furthestStep ?? undefined, furthestIndex: Math.max(0, furthestIndex) },
    update: data,
  });
  if (storedEvents.length > 0) await prisma.formEvent.createMany({
    data: storedEvents.map((e) => ({
      sessionId,
      at: e.at && !Number.isNaN(Date.parse(e.at)) ? new Date(e.at) : new Date(),
      type: String(e.type ?? "unknown").slice(0, 40),
      step: typeof e.step === "string" ? e.step.slice(0, 60) : null,
      elapsedMs: typeof e.elapsed_ms === "number" ? Math.round(e.elapsed_ms) : null,
      metaJson: e.meta && typeof e.meta === "object" ? JSON.parse(JSON.stringify(e.meta)) : undefined,
    })),
  });

  return NextResponse.json({ ok: true, stored: storedEvents.length }, { headers });
}
