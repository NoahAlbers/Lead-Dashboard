import { prisma } from "@/lib/db";

export async function generateReceiptId(): Promise<string> {
  const year = new Date().getFullYear();
  // Use upsert with increment to atomically get next number
  const seq = await prisma.receiptSequence.upsert({
    where: { year },
    update: { lastNum: { increment: 1 } },
    create: { year, lastNum: 1 },
  });
  return `ACB-${year}-${String(seq.lastNum).padStart(4, "0")}`;
}
