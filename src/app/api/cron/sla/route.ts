import { NextResponse } from "next/server";
import { recalculateAllSlas } from "@/services/sla.service";

export async function POST(request: Request) {
  // Verify cron secret
  const secret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recalculateAllSlas();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("SLA recalculation failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Also allow GET for Vercel Cron
export async function GET(request: Request) {
  return POST(request);
}
