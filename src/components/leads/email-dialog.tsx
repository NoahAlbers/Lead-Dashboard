"use client";

import { useState } from "react";
import { X, Mail, ExternalLink } from "lucide-react";
import { logQuickAction } from "@/actions/note.actions";

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

interface LeadData {
  id: string;
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  phone?: string | null;
  state?: string | null;
  industry?: string | null;
  notesFromForm?: string | null;
}

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  lead: LeadData;
  templates: EmailTemplate[];
  assignedUserName?: string;
  referralPartnerName?: string;
}

function renderTemplate(
  template: string,
  lead: LeadData,
  assignedUserName: string,
  referralPartnerName: string
): string {
  return template
    .replaceAll("{{full_name}}", lead.fullName ?? "")
    .replaceAll("{{company_name}}", lead.companyName ?? "")
    .replaceAll("{{email}}", lead.email ?? "")
    .replaceAll("{{phone}}", lead.phone ?? "")
    .replaceAll("{{state}}", lead.state ?? "")
    .replaceAll("{{industry}}", lead.industry ?? "")
    .replaceAll("{{notes_from_form}}", lead.notesFromForm ?? "")
    .replaceAll("{{assigned_user_name}}", assignedUserName)
    .replaceAll("{{referral_partner_name}}", referralPartnerName);
}

function buildMailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const TYPE_COLORS: Record<string, string> = {
  intro: "bg-blue-100 text-blue-700",
  referral: "bg-orange-100 text-orange-700",
  follow_up: "bg-amber-100 text-amber-700",
  internal_handoff: "bg-purple-100 text-purple-700",
};

export function EmailDialog({
  open,
  onClose,
  lead,
  templates,
  assignedUserName = "ACB Team",
  referralPartnerName = "",
}: EmailDialogProps) {
  const [isPending, setIsPending] = useState(false);

  if (!open) return null;

  async function handleUseTemplate(template: EmailTemplate) {
    const subject = renderTemplate(template.subjectTemplate, lead, assignedUserName, referralPartnerName);
    const body = renderTemplate(template.bodyTemplate, lead, assignedUserName, referralPartnerName);
    const mailto = buildMailto(lead.email, subject, body);
    window.open(mailto, "_self");

    setIsPending(true);
    await logQuickAction(lead.id, "contacted_email");
    setIsPending(false);
    onClose();
  }

  async function handleEmailDirectly() {
    window.open(`mailto:${lead.email}`, "_self");

    setIsPending(true);
    await logQuickAction(lead.id, "contacted_email");
    setIsPending(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-xl border shadow-lg w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Email {lead.fullName || lead.companyName || "Lead"}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {templates.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">Choose a template:</p>
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleUseTemplate(tmpl)}
                  disabled={isPending}
                  className="w-full rounded-lg border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{tmpl.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[tmpl.type] ?? "bg-muted text-muted-foreground"}`}>
                      {tmpl.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Subject: {tmpl.subjectTemplate}
                  </p>
                </button>
              ))}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-border" />
                <span className="px-3 text-xs text-muted-foreground">or</span>
                <div className="flex-grow border-t border-border" />
              </div>
            </>
          )}

          <button
            onClick={handleEmailDirectly}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            Email Directly (no template)
          </button>
        </div>
      </div>
    </div>
  );
}
