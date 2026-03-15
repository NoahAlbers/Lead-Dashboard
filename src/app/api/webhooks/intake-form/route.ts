import { NextRequest, NextResponse } from "next/server";
import { ingestLead } from "@/services/lead-ingestion.service";
import { normalizeState } from "@/lib/us-states";

// --- CORS ---
const ALLOWED_ORIGINS = [
  "https://noahalbers.github.io",
  "https://www.advancedcb.com",
  "https://advancedcb.com",
  "http://localhost:3000",
];

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, x-webhook-secret",
    "Access-Control-Max-Age": "86400",
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

// --- Helpers ---

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
  // "We own and manage for others (81% own / 19% manage)"
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

function joinArray(val: unknown): string {
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "string") return val;
  return "";
}

// --- Detect payload format and normalize ---

interface NormalizedPayload {
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
  // Tracking
  location?: string;
  device?: string;
  referrer?: string;
  clarityRecording?: string;
  timezone?: string;
  submittedAt?: string;
}

function normalizePayload(body: Record<string, unknown>): NormalizedPayload {
  // Detect FormSubmit display-name format (has "Name" key) vs camelCase format (has "fullName" key)
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

  // camelCase format (original internal format)
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

// --- POST handler ---

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);

  // Auth: accept either webhook secret header OR allow if origin is in allowlist
  const secret = request.headers.get("x-webhook-secret");
  const origin = request.headers.get("origin") ?? "";
  const hasValidSecret = secret && secret === process.env.WEBHOOK_SECRET;
  const hasValidOrigin = ALLOWED_ORIGINS.includes(origin);

  if (!hasValidSecret && !hasValidOrigin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const body = await request.json();
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

    // Build the raw intake form object for storage (preserves all fields for detail view)
    const rawIntakeForm = {
      ...p,
      // Keep these as arrays for the detail view to render as pills
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
      "account-volume": p.totalUnits || undefined,
      "urgency": urgency,
      "_rawIntakeForm": rawIntakeForm,
    };

    const metadata = {
      source: "intake_form",
      sourcePage: body.sourcePage ?? body["Source Page"] ?? undefined,
      utmSource: body.utm_source ?? undefined,
      utmMedium: body.utm_medium ?? undefined,
      utmCampaign: body.utm_campaign ?? undefined,
      referrer: p.referrer ?? undefined,
    };

    const lead = await ingestLead(formData, metadata);

    return NextResponse.json(
      { success: true, leadId: lead.id },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Intake form ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to process lead" },
      { status: 500, headers }
    );
  }
}
