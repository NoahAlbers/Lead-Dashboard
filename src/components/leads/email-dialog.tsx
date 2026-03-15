"use client";

import { useState } from "react";
import { X, ExternalLink, ChevronRight, ArrowLeft, Info } from "lucide-react";
import { logQuickAction } from "@/actions/note.actions";

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
  emailType?: { color: string; isReferral: boolean } | null;
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

interface ReferralPartner {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  emails: string[] | null;
  phone: string | null;
  website: string | null;
  statesServed: string[] | null;
  specialties: string[] | null;
  industries: string[] | null;
  minimumClaimSize: number | null;
  maximumClaimSize: number | null;
  notes: string | null;
}

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  lead: LeadData;
  templates: EmailTemplate[];
  assignedUserName?: string;
  referralPartners?: ReferralPartner[];
}

function renderTemplate(
  template: string,
  lead: LeadData,
  assignedUserName: string,
  partner?: ReferralPartner | null
): string {
  let result = template
    .replaceAll("{{full_name}}", lead.fullName ?? "")
    .replaceAll("{{company_name}}", lead.companyName ?? "")
    .replaceAll("{{email}}", lead.email ?? "")
    .replaceAll("{{phone}}", lead.phone ?? "")
    .replaceAll("{{state}}", lead.state ?? "")
    .replaceAll("{{industry}}", lead.industry ?? "")
    .replaceAll("{{notes_from_form}}", lead.notesFromForm ?? "")
    .replaceAll("{{assigned_user_name}}", assignedUserName);

  if (partner) {
    result = result
      .replaceAll("{{referral_partner_name}}", partner.name)
      .replaceAll("{{referral_partner_email}}", partner.email ?? "")
      .replaceAll("{{referral_partner_phone}}", partner.phone ?? "")
      .replaceAll("{{referral_partner_website}}", partner.website ?? "")
      .replaceAll("{{referral_partner_contact_name}}", partner.contactName ?? "");
  }

  return result;
}

function buildMailto(to: string, subject: string, body: string): string {
  // Strip HTML tags for mailto body
  const plainBody = body.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
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
  referralPartners = [],
}: EmailDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [step, setStep] = useState<"templates" | "partners" | "partner-detail">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<ReferralPartner | null>(null);
  const [detailPartner, setDetailPartner] = useState<ReferralPartner | null>(null);

  if (!open) return null;

  function handleSelectTemplate(template: EmailTemplate) {
    const isReferral = template.emailType?.isReferral || template.type === "referral";
    if (isReferral && referralPartners.length > 0) {
      setSelectedTemplate(template);
      setStep("partners");
    } else {
      sendWithTemplate(template, null);
    }
  }

  function handleSelectPartner(partner: ReferralPartner) {
    setSelectedPartner(partner);
    sendWithTemplate(selectedTemplate!, partner);
  }

  async function sendWithTemplate(template: EmailTemplate, partner: ReferralPartner | null) {
    const subject = renderTemplate(template.subjectTemplate, lead, assignedUserName, partner);
    const body = renderTemplate(template.bodyTemplate, lead, assignedUserName, partner);
    const recipient = partner?.email ?? lead.email;
    const mailto = buildMailto(recipient, subject, body);
    window.open(mailto, "_self");

    setIsPending(true);
    await logQuickAction(lead.id, "contacted_email");
    setIsPending(false);
    resetAndClose();
  }

  async function handleEmailDirectly() {
    window.open(`mailto:${lead.email}`, "_self");
    setIsPending(true);
    await logQuickAction(lead.id, "contacted_email");
    setIsPending(false);
    resetAndClose();
  }

  function resetAndClose() {
    setStep("templates");
    setSelectedTemplate(null);
    setSelectedPartner(null);
    setDetailPartner(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={resetAndClose}>
      <div
        className="bg-card rounded-xl border shadow-lg w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {step !== "templates" && (
            <button onClick={() => { setStep("templates"); setDetailPartner(null); }} className="rounded-md p-1 hover:bg-muted mr-2">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h3 className="font-semibold flex-1">
            {step === "templates" && `Email ${lead.fullName || lead.companyName || "Lead"}`}
            {step === "partners" && "Select Referral Partner"}
            {step === "partner-detail" && detailPartner?.name}
          </h3>
          <button onClick={resetAndClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Step 1: Template Selection */}
          {step === "templates" && (
            <>
              {templates.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">Choose a template:</p>
                  {templates.map((tmpl) => {
                    const typeColor = tmpl.emailType?.color;
                    const isReferral = tmpl.emailType?.isReferral || tmpl.type === "referral";
                    const badgeStyle = typeColor
                      ? { backgroundColor: typeColor + "30", color: typeColor }
                      : undefined;
                    const badgeClass = !typeColor ? (TYPE_COLORS[tmpl.type] ?? "bg-muted text-muted-foreground") : "";

                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => handleSelectTemplate(tmpl)}
                        disabled={isPending}
                        className="w-full rounded-lg border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{tmpl.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                            style={badgeStyle}
                          >
                            {tmpl.type.replace(/_/g, " ")}
                          </span>
                          {isReferral && (
                            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">Referral</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Subject: {tmpl.subjectTemplate}
                        </p>
                      </button>
                    );
                  })}
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
            </>
          )}

          {/* Step 2: Partner Selection */}
          {step === "partners" && (
            <>
              <p className="text-sm text-muted-foreground">Select which partner to refer this lead to:</p>
              {referralPartners.map((partner) => (
                <div key={partner.id} className="rounded-lg border p-3 hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSelectPartner(partner)}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium text-sm">{partner.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {partner.statesServed?.slice(0, 5).map((s) => (
                          <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</span>
                        ))}
                        {(partner.statesServed?.length ?? 0) > 5 && (
                          <span className="text-[10px] text-muted-foreground">+{(partner.statesServed?.length ?? 0) - 5}</span>
                        )}
                      </div>
                      {partner.specialties && partner.specialties.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{partner.specialties.join(", ")}</p>
                      )}
                      {(partner.minimumClaimSize || partner.maximumClaimSize) && (
                        <p className="text-xs text-muted-foreground">
                          Claim: ${partner.minimumClaimSize?.toLocaleString() ?? "0"} - ${partner.maximumClaimSize?.toLocaleString() ?? "∞"}
                        </p>
                      )}
                    </button>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => { setDetailPartner(partner); setStep("partner-detail"); }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="More info"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSelectPartner(partner)}
                        className="rounded p-1.5 text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {referralPartners.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No active referral partners configured.</p>
              )}
            </>
          )}

          {/* Step 3: Partner Detail */}
          {step === "partner-detail" && detailPartner && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {detailPartner.contactName && <div><p className="text-muted-foreground text-xs">Contact</p><p className="font-medium">{detailPartner.contactName}</p></div>}
                {detailPartner.email && <div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium">{detailPartner.email}</p></div>}
                {detailPartner.phone && <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{detailPartner.phone}</p></div>}
                {detailPartner.website && <div><p className="text-muted-foreground text-xs">Website</p><a href={detailPartner.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline text-sm">{detailPartner.website}</a></div>}
              </div>
              {detailPartner.emails && detailPartner.emails.length > 1 && (
                <div><p className="text-muted-foreground text-xs mb-1">All Emails</p>{detailPartner.emails.map((e, i) => <p key={i} className="text-sm">{e}</p>)}</div>
              )}
              {detailPartner.statesServed && detailPartner.statesServed.length > 0 && (
                <div><p className="text-muted-foreground text-xs mb-1">States Served</p><div className="flex flex-wrap gap-1">{detailPartner.statesServed.map((s) => <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs">{s}</span>)}</div></div>
              )}
              {detailPartner.industries && detailPartner.industries.length > 0 && (
                <div><p className="text-muted-foreground text-xs mb-1">Industries</p><p className="text-sm">{detailPartner.industries.join(", ")}</p></div>
              )}
              {detailPartner.notes && (
                <div><p className="text-muted-foreground text-xs mb-1">Notes</p><p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">{detailPartner.notes}</p></div>
              )}
              <button
                onClick={() => handleSelectPartner(detailPartner)}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Select {detailPartner.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
