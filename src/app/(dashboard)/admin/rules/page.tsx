import { getRules } from "@/actions/rule.actions";
import { RulesManager } from "@/components/admin/rules-manager";

export default async function RulesPage() {
  const rules = await getRules();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scoring Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how leads are scored and qualified
        </p>
      </div>
      <RulesManager
        initialRules={rules.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
