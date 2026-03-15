import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLeadsForComparison } from "@/actions/merge.actions";
import { MergeComparison } from "@/components/leads/merge-comparison";

interface PageProps {
  searchParams: Promise<{ leadA?: string; leadB?: string }>;
}

export default async function MergePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { leadA: leadAId, leadB: leadBId } = params;

  if (!leadAId || !leadBId) {
    redirect("/leads");
  }

  if (leadAId === leadBId) {
    redirect(`/leads/${leadAId}`);
  }

  const { leadA, leadB } = await getLeadsForComparison(leadAId, leadBId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/leads/${leadAId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-bold">Merge Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare and merge two lead records. Select which values to keep for each field.
        </p>
      </div>

      <MergeComparison leadA={leadA} leadB={leadB} />
    </div>
  );
}
