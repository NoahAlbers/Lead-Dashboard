import { NextRequest, NextResponse } from "next/server";
import { ingestLead } from "@/services/lead-ingestion.service";

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Map ACB intake form fields to canonical lead fields
    const formData: Record<string, unknown> = {
      "full_name": body.fullName,
      "company": body.companyName,
      "email": body.email,
      "phone": body.phone,
      "message": body.message,
      // ACB-specific fields stored directly
      "debt_type": Array.isArray(body.debtTypes)
        ? body.debtTypes.join(", ")
        : body.debtTypes,
      "service_requested": "collections",
      "business-type": Array.isArray(body.rentalTypes)
        ? body.rentalTypes.join(", ")
        : body.rentalTypes,
      "industry": Array.isArray(body.propertyTypes)
        ? body.propertyTypes.join(", ")
        : body.propertyTypes,
      "state": Array.isArray(body.states)
        ? body.states.join(", ")
        : body.states,
    };

    const metadata = {
      source: "intake_form",
      sourcePage: body.sourcePage ?? undefined,
      utmSource: body.utm_source ?? undefined,
      utmMedium: body.utm_medium ?? undefined,
      utmCampaign: body.utm_campaign ?? undefined,
      referrer: body.referrer ?? undefined,
    };

    // Store the full raw payload with all ACB-specific fields
    const fullPayload = {
      ...body,
      _mappedTo: formData,
    };

    const lead = await ingestLead(
      { ...formData, _rawIntakeForm: fullPayload },
      metadata
    );

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
