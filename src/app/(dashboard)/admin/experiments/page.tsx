import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listExperiments } from "@/actions/experiment.actions";
import { ExperimentsManager } from "@/components/admin/experiments-manager";

export default async function ExperimentsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/leads");
  const experiments = await listExperiments();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Form Experiments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A/B tests on the intake form. Variants are assigned per visitor and follow the lead through to won or lost.
        </p>
      </div>
      <ExperimentsManager
        initial={experiments.map((e) => ({
          id: e.id,
          key: e.key,
          name: e.name,
          hypothesis: e.hypothesis,
          status: e.status,
          primaryGoal: e.primaryGoal as "completed" | "contact_reached" | "hot_lead",
          variants: (e.variantsJson as Array<{ key: string; weight: number; description?: string; flags?: Record<string, boolean | string | number> }>) ?? [],
          startedAt: e.startedAt?.toISOString() ?? null,
          endedAt: e.endedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
