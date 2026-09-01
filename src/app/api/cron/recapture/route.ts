import { NextResponse } from "next/server";
import { processRecaptureQueue } from "@/services/recapture.service";

// Advances the abandoned-form recapture sequence. Schedule every 15 minutes,
// same auth pattern as the partials cron.

export async function POST(request: Request) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processRecaptureQueue();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Recapture cron failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
