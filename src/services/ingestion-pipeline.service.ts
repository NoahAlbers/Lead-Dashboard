import { prisma } from "@/lib/db";
import { ingestLead } from "@/services/lead-ingestion.service";
import { normalizeState } from "@/lib/us-states";
import {
  sendFailureAlertEmail,
  sendNewLeadEmail,
} from "@/services/email-notification.service";
import { logger } from "@/lib/logger";

// --- Helpers (mirrored from intake-form route for consistency) ---

function extractUrl(htmlOrText: unknown): string {
  if (!htmlOrText || typeof htmlOrText !== "string") return "";
  const match = htmlOrText.match(/href="([^"]+)"/);
  return match ? match[1] : htmlOrText;
}

function parseCurrency(val: unknown): number | undefined {
  if (!val) return undefined;
  const num = Number(String(val).replace(/[$,]/g, ""));
  return isNaN(num) || num === 0 ? undefined : num;
}

function parseOwnership(val: unknown): { type: string; ownPercent?: number } {
  if (!val || typeof val !== "string") return { type: "" };
  const match = val.match(/^(.+?)\s*\((\d+)%\s*own/);
  if (match) {
    return { type: match[1].trim(), ownPercent: Number(match[2]) };
  }
  return { type: val };
}

function splitComma(val: unknown): string[] {
  if (!val || typeof val !== "string") return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface NormalizedPayload {
  fullName?: string;
  companyName?: string;
  noCompany?: boolean;
  companyWebsite?: string;
  noWebsite?: boolean;
  email?: string;
  phone?: string;
  debtTypes: string[];
  customDebtType?: string;
  debtsNow?: string;
  priorAgency?: string;
  states: string[];
  ownershipType?: string;
  ownPercent?: number;
  totalUnits?: string;
  rentalTypes: string[];
  propertyTypes: string[];
  avgRent?: number;
  listingSites: string[];
  customListing?: string;
  pmSoftware: string[];
  customPM?: string;
  comments?: string;
  noQuestions?: boolean;
  certifyOwesDebt?: boolean;
  certifyNoDebt?: boolean;
  location?: string;
  device?: string;
  referrer?: string;
  clarityRecording?: string;
  timezone?: string;
  submittedAt?: string;
}

function normalizePayload(body: Record<string, unknown>): NormalizedPayload {
  const isDisplayFormat = "Name" in body || "Email" in body || "Phone Number" in body;

  if (isDisplayFormat) {
    const ownership = parseOwnership(body["Ownership"]);
    return {
      fullName: body["Name"] as string | undefined,
      companyName: body["Company"] as string | undefined,
      email: body["Email"] as string | undefined,
      phone: body["Phone Number"] as string | undefined,
      companyWebsite: extractUrl(body["Website"]) || undefined,
      debtTypes: splitComma(body["Debt Types"]),
      debtsNow: body["Debts Ready Now"] as string | undefined,
      priorAgency: body["Prior Collection Agency"] as string | undefined,
      states: splitComma(body["States"]).map(normalizeState).filter(Boolean),
      ownershipType: ownership.type || undefined,
      ownPercent: ownership.ownPercent,
      totalUnits: body["Total Units"] as string | undefined,
      rentalTypes: splitComma(body["Rental Types"]),
      propertyTypes: splitComma(body["Property Types"]),
      avgRent: parseCurrency(body["Avg Rent / Unit"]),
      listingSites: splitComma(body["Listing Sites"]),
      pmSoftware: splitComma(body["PM Software"]),
      comments: body["Comments"] as string | undefined,
      location: body["Location / IP"] as string | undefined,
      device: body["Device"] as string | undefined,
      referrer: body["Referrer"] as string | undefined,
      clarityRecording: extractUrl(body["Clarity Recording"]) || undefined,
      timezone: body["Likely Timezone"] as string | undefined,
      submittedAt: body["Submitted (EST)"] as string | undefined,
    };
  }

  // camelCase format
  const ownership2 = parseOwnership(body.ownershipType);
  return {
    fullName: body.fullName as string | undefined,
    companyName: body.companyName as string | undefined,
    noCompany: body.noCompany as boolean | undefined,
    companyWebsite: body.companyWebsite as string | undefined,
    noWebsite: body.noWebsite as boolean | undefined,
    email: body.email as string | undefined,
    phone: body.phone as string | undefined,
    debtTypes: Array.isArray(body.debtTypes) ? body.debtTypes : splitComma(body.debtTypes),
    customDebtType: body.customDebtType as string | undefined,
    debtsNow: body.debtsNow as string | undefined,
    priorAgency: body.priorAgency as string | undefined,
    states: (Array.isArray(body.states) ? body.states : splitComma(body.states)).map(normalizeState).filter(Boolean),
    ownershipType: ownership2.type || (body.ownershipType as string | undefined),
    ownPercent: ownership2.ownPercent ?? (body.ownPercent as number | undefined),
    totalUnits: body.totalUnits as string | undefined,
    rentalTypes: Array.isArray(body.rentalTypes) ? body.rentalTypes : splitComma(body.rentalTypes),
    propertyTypes: Array.isArray(body.propertyTypes) ? body.propertyTypes : splitComma(body.propertyTypes),
    avgRent: typeof body.avgRent === "number" ? body.avgRent : parseCurrency(body.avgRent),
    listingSites: Array.isArray(body.listingSites) ? body.listingSites : splitComma(body.listingSites),
    customListing: body.customListing as string | undefined,
    pmSoftware: Array.isArray(body.pmSoftware) ? body.pmSoftware : splitComma(body.pmSoftware),
    customPM: body.customPM as string | undefined,
    comments: body.comments as string | undefined,
    noQuestions: body.noQuestions as boolean | undefined,
    certifyOwesDebt: body.certifyOwesDebt as boolean | undefined,
    certifyNoDebt: body.certifyNoDebt as boolean | undefined,
    location: body.location as string | undefined,
    device: body.device as string | undefined,
    referrer: body.referrer as string | undefined,
    clarityRecording: body.clarityRecording as string | undefined,
    timezone: (body.timezone ?? body.likelyTimezone) as string | undefined,
    submittedAt: body.submittedAt as string | undefined,
  };
}

/**
 * Build the formData and metadata objects that ingestLead() expects,
 * matching the exact format used by the intake-form webhook route.
 */
function buildIngestArgs(body: Record<string, unknown>) {
  const p = normalizePayload(body);

  // Build notes string
  const notesParts: string[] = [];
  if (p.noCompany) notesParts.push("Independent owner (no company)");
  if (p.companyWebsite && !p.noWebsite) notesParts.push(`Website: ${p.companyWebsite}`);
  else if (p.noWebsite) notesParts.push("No website");
  if (p.debtTypes.length) notesParts.push(`Debt Types: ${p.debtTypes.join(", ")}${p.customDebtType ? ` (${p.customDebtType})` : ""}`);
  if (p.debtsNow) notesParts.push(`Debts ready now: ${p.debtsNow}`);
  if (p.priorAgency) notesParts.push(`Prior collection agency: ${p.priorAgency}`);
  if (p.ownershipType) {
    let ownership = p.ownershipType;
    if (p.ownPercent != null) ownership += ` (${p.ownPercent}% own / ${100 - p.ownPercent}% manage)`;
    notesParts.push(`Ownership: ${ownership}`);
  }
  if (p.totalUnits) notesParts.push(`Total units: ${p.totalUnits}`);
  if (p.rentalTypes.length) notesParts.push(`Rental types: ${p.rentalTypes.join(", ")}`);
  if (p.propertyTypes.length) notesParts.push(`Property types: ${p.propertyTypes.join(", ")}`);
  if (p.avgRent) notesParts.push(`Avg rent/unit: $${p.avgRent.toLocaleString()}`);
  if (p.listingSites.length) notesParts.push(`Listing sites: ${p.listingSites.join(", ")}${p.customListing ? ` (${p.customListing})` : ""}`);
  if (p.pmSoftware.length) notesParts.push(`PM software: ${p.pmSoftware.join(", ")}${p.customPM ? ` (${p.customPM})` : ""}`);
  if (p.comments && !p.noQuestions) notesParts.push(`Comments: ${p.comments}`);
  if (p.certifyOwesDebt) notesParts.push("Certified: tenants owe debt");
  if (p.certifyNoDebt) notesParts.push("Certified: no debt owed");

  // Determine urgency
  let urgency: string | undefined;
  if (p.debtsNow) {
    if (p.debtsNow.toLowerCase().includes("yes")) urgency = "high";
    else if (p.debtsNow.toLowerCase().includes("not yet")) urgency = "medium";
    else if (p.debtsNow.toLowerCase().includes("no")) urgency = "low";
  }

  // Raw intake form for detail view (preserves arrays)
  const rawIntakeForm = {
    ...p,
    debtTypes: p.debtTypes,
    states: p.states,
    rentalTypes: p.rentalTypes,
    propertyTypes: p.propertyTypes,
    listingSites: p.listingSites,
    pmSoftware: p.pmSoftware,
  };

  const formData: Record<string, unknown> = {
    "full_name": p.fullName,
    "company": p.noCompany ? undefined : p.companyName,
    "email": p.email,
    "phone": p.phone,
    "notes": notesParts.join("\n"),
    "debt_type": p.debtTypes.join(", ") + (p.customDebtType ? `, ${p.customDebtType}` : ""),
    "service_requested": "collections",
    "business-type": p.rentalTypes.join(", "),
    "industry": p.propertyTypes.join(", "),
    "state": normalizeState(p.states[0]) || undefined,
    "states_array": p.states.length > 0 ? p.states : undefined,
    "account-volume": p.totalUnits || undefined,
    "urgency": urgency,
    "_rawIntakeForm": rawIntakeForm,
  };

  const metadata = {
    source: "intake_form",
    sourcePage: (body.sourcePage ?? body["Source Page"] ?? undefined) as string | undefined,
    utmSource: (body.utm_source ?? undefined) as string | undefined,
    utmMedium: (body.utm_medium ?? undefined) as string | undefined,
    utmCampaign: (body.utm_campaign ?? undefined) as string | undefined,
    referrer: p.referrer ?? undefined,
  };

  return { formData, metadata, normalized: p };
}

// --- Pipeline entry point ---

export async function processIngestionItem(queueId: string): Promise<void> {
  const item = await prisma.ingestionQueue.findUnique({ where: { id: queueId } });
  if (!item || item.status === "completed" || item.status === "duplicate") return;

  logger.info("PIPELINE", "Processing started", {
    queueId,
    submissionId: item.submissionId,
    sessionId: item.sessionId,
  });

  try {
    // Mark as processing
    await prisma.ingestionQueue.update({
      where: { id: queueId },
      data: { status: "processing" },
    });

    const payload = item.rawPayload as Record<string, unknown>;
    // The rawPayload may have fields nested under "fields" or at top level
    const body = (payload.fields ?? payload) as Record<string, unknown>;
    const payloadMetadata = (payload.metadata ?? {}) as Record<string, unknown>;

    // Merge any payload-level metadata into body for buildIngestArgs
    if (payloadMetadata.utm_source) body.utm_source = payloadMetadata.utm_source;
    if (payloadMetadata.utm_medium) body.utm_medium = payloadMetadata.utm_medium;
    if (payloadMetadata.utm_campaign) body.utm_campaign = payloadMetadata.utm_campaign;
    if (payloadMetadata.source_page) body.sourcePage = payloadMetadata.source_page;
    if (payloadMetadata.referrer && !body.referrer) body.referrer = payloadMetadata.referrer;

    // Check for partial records with same sessionId — merge fields
    if (item.sessionId) {
      const partials = await prisma.ingestionQueue.findMany({
        where: {
          sessionId: item.sessionId,
          isPartial: true,
          status: "partial",
          id: { not: queueId },
        },
        orderBy: { receivedAt: "asc" },
      });
      for (const partial of partials) {
        const partialPayload = partial.rawPayload as Record<string, unknown>;
        const partialFields = (partialPayload.fields ?? partialPayload) as Record<string, unknown>;
        // Merge partial fields into body (main/final takes priority)
        for (const [k, v] of Object.entries(partialFields)) {
          if (!(k in body) && v != null) {
            body[k] = v;
          }
        }
        // Mark partial as completed
        await prisma.ingestionQueue.update({
          where: { id: partial.id },
          data: { status: "completed", processedAt: new Date() },
        });
      }
    }

    // Build formData and metadata matching what the intake-form route passes to ingestLead
    const { formData, metadata, normalized } = buildIngestArgs(body);

    // Validate — need email OR phone
    if (!normalized.email && !normalized.phone) {
      await prisma.ingestionQueue.update({
        where: { id: queueId },
        data: {
          status: "failed",
          errorMessage: "Validation failed: no email or phone provided",
          retryCount: { increment: 1 },
        },
      });
      return;
    }

    // Override source from payload metadata if provided
    if (payloadMetadata.source && typeof payloadMetadata.source === "string") {
      metadata.source = payloadMetadata.source;
    }

    // Call existing ingestLead — it handles mapping, scoring, duplicates, referrals, notifications
    const lead = await ingestLead(formData, metadata);

    logger.info("PIPELINE", "Lead ingested successfully", {
      queueId,
      leadId: lead.id,
      submissionId: item.submissionId,
    });

    // Send email notification with full normalized data
    sendNewLeadEmail({
      receiptId: item.receiptId || "N/A",
      normalized,
      score: lead.score ?? undefined,
      qualityTier: lead.qualityTier ?? undefined,
      recommendedAction: lead.recommendedAction ?? undefined,
      leadId: lead.id,
    }).catch((err) => {
      logger.error("PIPELINE", "Email notification failed (non-blocking)", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Update queue with success
    await prisma.ingestionQueue.update({
      where: { id: queueId },
      data: {
        status: "completed",
        leadId: lead.id,
        processedAt: new Date(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("PIPELINE", `Ingestion failed for queue ${queueId}`, {
      error: message,
    });
    await prisma.ingestionQueue
      .update({
        where: { id: queueId },
        data: {
          status: "failed",
          errorMessage: message.slice(0, 2000),
          retryCount: { increment: 1 },
        },
      })
      .catch(() => {});

    sendFailureAlertEmail({
      type: "pipeline_failure",
      message,
      submissionId: item?.submissionId,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }
}

// --- Retry failed items (called by cron or manually) ---

export async function retryFailedItems(): Promise<number> {
  const items = await prisma.ingestionQueue.findMany({
    where: { status: "failed", retryCount: { lt: 3 } },
    orderBy: { receivedAt: "asc" },
    take: 50,
  });

  let retried = 0;
  for (const item of items) {
    try {
      // Reset status so processIngestionItem will pick it up
      await prisma.ingestionQueue.update({
        where: { id: item.id },
        data: { status: "received" },
      });
      await processIngestionItem(item.id);
      retried++;
    } catch (err) {
      console.error(`Retry failed for ${item.id}:`, err);
    }
  }
  return retried;
}

// --- Process all pending items in the queue ---

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  const items = await prisma.ingestionQueue.findMany({
    where: { status: "received", isPartial: false },
    orderBy: { receivedAt: "asc" },
    take: 100,
  });

  let processed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await processIngestionItem(item.id);
      processed++;
    } catch {
      failed++;
    }
  }

  return { processed, failed };
}
