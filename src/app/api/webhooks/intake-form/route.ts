import { NextRequest, NextResponse } from "next/server";
import { ingestLead } from "@/services/lead-ingestion.service";

function joinArray(val: unknown): string {
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "string") return val;
  return "";
}

function formatRent(val: unknown): string {
  const num = Number(val);
  if (isNaN(num) || num === 0) return "";
  return `$${num.toLocaleString()}`;
}

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Build a comprehensive notes string from all ACB-specific fields
    const notesParts: string[] = [];

    if (body.noCompany) {
      notesParts.push("Independent owner (no company)");
    }
    if (body.companyWebsite && !body.noWebsite) {
      notesParts.push(`Website: ${body.companyWebsite}`);
    } else if (body.noWebsite) {
      notesParts.push("No website");
    }
    if (body.debtTypes?.length) {
      notesParts.push(`Debt Types: ${joinArray(body.debtTypes)}${body.customDebtType ? ` (${body.customDebtType})` : ""}`);
    }
    if (body.debtsNow) {
      notesParts.push(`Debts ready now: ${body.debtsNow}`);
    }
    if (body.priorAgency) {
      notesParts.push(`Prior collection agency: ${body.priorAgency}`);
    }
    if (body.ownershipType) {
      let ownership = body.ownershipType;
      if (body.ownershipType === "We own and manage for others" && body.ownPercent != null) {
        ownership += ` (${body.ownPercent}% own / ${100 - Number(body.ownPercent)}% manage)`;
      }
      notesParts.push(`Ownership: ${ownership}`);
    }
    if (body.totalUnits) {
      notesParts.push(`Total units: ${body.totalUnits}`);
    }
    if (body.rentalTypes?.length) {
      notesParts.push(`Rental types: ${joinArray(body.rentalTypes)}`);
    }
    if (body.propertyTypes?.length) {
      notesParts.push(`Property types: ${joinArray(body.propertyTypes)}`);
    }
    if (body.avgRent && body.avgRent !== 1500) {
      notesParts.push(`Avg rent/unit: ${formatRent(body.avgRent)}`);
    }
    if (body.listingSites?.length) {
      notesParts.push(`Listing sites: ${joinArray(body.listingSites)}${body.customListing ? ` (${body.customListing})` : ""}`);
    }
    if (body.pmSoftware?.length) {
      notesParts.push(`PM software: ${joinArray(body.pmSoftware)}${body.customPM ? ` (${body.customPM})` : ""}`);
    }
    if (body.comments && !body.noQuestions) {
      notesParts.push(`Comments: ${body.comments}`);
    }
    if (body.certifyOwesDebt) {
      notesParts.push("Certified: tenants owe debt");
    }
    if (body.certifyNoDebt) {
      notesParts.push("Certified: no debt owed");
    }

    // Estimate balance from units and avg rent (rough proxy)
    let estimatedBalance: number | undefined;
    if (body.totalUnits && body.avgRent) {
      const units = parseInt(body.totalUnits, 10);
      if (!isNaN(units) && units > 0) {
        // Rough estimate: avg rent * units as a proxy for portfolio size
        estimatedBalance = units * Number(body.avgRent);
      }
    }

    // Map to canonical lead fields
    const formData: Record<string, unknown> = {
      "full_name": body.fullName,
      "company": body.noCompany ? undefined : body.companyName,
      "email": body.email,
      "phone": body.phone,
      "notes": notesParts.join("\n"),
      "debt_type": joinArray(body.debtTypes) + (body.customDebtType ? `, ${body.customDebtType}` : ""),
      "service_requested": "collections",
      "business-type": joinArray(body.rentalTypes),
      "industry": joinArray(body.propertyTypes),
      "state": Array.isArray(body.states) ? body.states[0] : body.states, // Primary state for scoring
      "account-volume": body.totalUnits || undefined,
      "balance_amount": estimatedBalance,
      "urgency": body.debtsNow === "Yes" ? "high" : body.debtsNow === "No" ? "low" : undefined,
    };

    const metadata = {
      source: "intake_form",
      sourcePage: body.sourcePage ?? undefined,
      utmSource: body.utm_source ?? undefined,
      utmMedium: body.utm_medium ?? undefined,
      utmCampaign: body.utm_campaign ?? undefined,
      referrer: body.referrer ?? undefined,
    };

    const lead = await ingestLead(formData, metadata);

    return NextResponse.json(
      { success: true, leadId: lead.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Intake form ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to process lead" },
      { status: 500 }
    );
  }
}
