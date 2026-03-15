"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/actions/template.actions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toast } from "@/components/ui/use-toast";

interface Template {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_TYPES = [
  { value: "intro", label: "Intro Email" },
  { value: "referral", label: "Referral Email" },
  { value: "follow_up", label: "Follow-Up Email" },
  { value: "internal_handoff", label: "Internal Handoff" },
];

export function TemplatesManager({
  initialTemplates,
}: {
  initialTemplates: Template[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    type: "intro",
    subjectTemplate: "",
    bodyTemplate: "",
    active: true,
  });

  function resetForm() {
    setForm({
      name: "",
      type: "intro",
      subjectTemplate: "",
      bodyTemplate: "",
      active: true,
    });
    setEditing(null);
    setIsCreating(false);
  }

  function startEdit(tmpl: Template) {
    setEditing(tmpl);
    setForm({
      name: tmpl.name,
      type: tmpl.type,
      subjectTemplate: tmpl.subjectTemplate,
      bodyTemplate: tmpl.bodyTemplate,
      active: tmpl.active,
    });
    setIsCreating(true);
  }

  function handleSave() {
    startTransition(async () => {
      if (editing) {
        await updateTemplate(editing.id, form);
        toast({ title: "Template updated" });
      } else {
        await createTemplate(form);
        toast({ title: "Template created" });
      }
      resetForm();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    startTransition(async () => {
      await deleteTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
      toast({ title: "Template deleted" });
    });
  }

  const inputClass =
    "mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      {/* Template List */}
      <div className="space-y-2">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className={`rounded-lg border bg-card p-4 ${!tmpl.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{tmpl.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {tmpl.type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Subject: {tmpl.subjectTemplate}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(tmpl)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(tmpl.id)}
                  className="p-1 hover:bg-muted rounded text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {isCreating ? (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">
            {editing ? "Edit Template" : "New Template"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputClass}
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Subject *</label>
            <input
              value={form.subjectTemplate}
              onChange={(e) =>
                setForm({ ...form, subjectTemplate: e.target.value })
              }
              className={inputClass}
              placeholder="Use {{company_name}}, {{full_name}}, etc."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Body *</label>
            <div className="mt-1">
              <RichTextEditor
                content={form.bodyTemplate}
                onChange={(html) => setForm({ ...form, bodyTemplate: html })}
                placeholder="Write your email template..."
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={
                isPending ||
                !form.name ||
                !form.subjectTemplate ||
                !form.bodyTemplate
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editing ? "Update Template" : "Create Template"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add Email Template
        </button>
      )}
    </div>
  );
}
