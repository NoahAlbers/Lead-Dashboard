import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formCorsHeaders, formPreflight } from "@/lib/form-cors";

// Running experiments for the intake form. Public, cacheable for a minute.
// The form assigns variants client-side from this list.

export async function OPTIONS(req: NextRequest) {
  return formPreflight(req, "GET, OPTIONS");
}

export async function GET(req: NextRequest) {
  const headers = { ...formCorsHeaders(req.headers.get("origin"), "GET, OPTIONS"), "Cache-Control": "public, max-age=60" };
  try {
    const rows = await prisma.experiment.findMany({ where: { status: "running" }, orderBy: { createdAt: "asc" } });
    const experiments = rows.map((e) => ({
      key: e.key,
      status: e.status,
      primary_goal: e.primaryGoal,
      variants: (e.variantsJson as Array<{ key: string; weight: number; flags?: Record<string, unknown> }>) ?? [],
    }));
    return NextResponse.json({ experiments }, { headers });
  } catch {
    return NextResponse.json({ experiments: [] }, { headers });
  }
}
