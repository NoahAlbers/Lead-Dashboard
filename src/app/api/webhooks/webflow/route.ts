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

    // Extract form data - Webflow Logic may nest it
    const formData = body.data ?? body.payload ?? body;

    // Extract metadata from headers or body
    const metadata = {
      source: "webflow",
      sourcePage: body.sourcePage ?? body.source_page ?? undefined,
      utmSource: body.utm_source ?? formData.utm_source ?? undefined,
      utmMedium: body.utm_medium ?? formData.utm_medium ?? undefined,
      utmCampaign: body.utm_campaign ?? formData.utm_campaign ?? undefined,
      referrer: body.referrer ?? undefined,
    };

    const lead = await ingestLead(formData, metadata);

    return NextResponse.json(
      { success: true, leadId: lead.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Webhook ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to process lead" },
      { status: 500 }
    );
  }
}
