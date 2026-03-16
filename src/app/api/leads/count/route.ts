import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [count, newest] = await Promise.all([
    prisma.lead.count({
      where: { status: { notIn: ["ARCHIVED", "MERGED"] } },
    }),
    prisma.lead.findFirst({
      where: { status: { notIn: ["ARCHIVED", "MERGED"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return NextResponse.json({ count, newestLeadAt: newest?.createdAt ?? null });
}
