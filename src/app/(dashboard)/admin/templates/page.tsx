import { getTemplates } from "@/actions/template.actions";
import { TemplatesManager } from "@/components/admin/templates-manager";

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage email templates with merge variables
        </p>
      </div>
      <TemplatesManager
        initialTemplates={templates.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
