"use client";

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink, ChevronRight, ArrowLeft, Info, FileDown, Copy, Check } from "lucide-react";
import { logQuickAction } from "@/actions/note.actions";
import { renderTemplate, type EmailLeadData } from "@/lib/email-template-render";
import {
  renderTemplateEmail,
  buildEml,
  downloadEml,
  emailFilename,
  wrapEmailDocument,
  copyHtmlToClipboard,
  BUILTIN_REFERRAL_TEMPLATE,
} from "@/lib/referral-email";

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
  emailType?: { color: string; isReferral: boolean } | null;
}

type LeadData = EmailLeadData;

interface ReferralPartner {
  id: string;
  name: string;
  contactName: string | null;
  defaultEmailTemplate?: EmailTemplate | null;
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
  // Financial Terms
  contingencyRate?: string | null;
  upfrontCosts?: string | null;
  paymentTerms?: string | null;
  commissionStructure?: string | null;
  // Account Requirements
  minimumAccounts?: number | null;
  minimumTotalBalance?: number | null;
  avgAccountAgePref?: string | null;
  accountTypesAccepted?: string | null;
  // Service Details
  collectionMethods?: string | null;
  licensedStates?: string[] | null;
  insuranceInfo?: string | null;
  yearsInBusiness?: number | null;
  complianceNotes?: string | null;
}

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  lead: LeadData;
  templates: EmailTemplate[];
  assignedUserName?: string;
  referralPartners?: ReferralPartner[];
  /** Raw intake form payload (rawPayloadJson._rawIntakeForm) for the data table. */
  rawIntakeForm?: Record<string, unknown> | null;
  /** When set on open, jump straight to composing a referral email for this partner. */
  autoReferralPartnerId?: string | null;
}

function isReferralTemplate(t: EmailTemplate): boolean {
  return Boolean(t.emailType?.isReferral) || t.type === "referral";
}

function htmlToPlainText(html: string): string {
  let text = html;

  // Decode HTML entities first
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Convert links: <a href="URL">text</a> → text (URL)
  text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, url, linkText) => {
    const cleanText = linkText.replace(/<[^>]+>/g, "").trim();
    if (cleanText === url || cleanText === url.replace(/^https?:\/\//, "")) return url;
    return `${cleanText} (${url})`;
  });

  // Handle ordered lists: number each <li> sequentially
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let counter = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, liContent: string) => {
      counter++;
      return `\n${counter}. ${liContent.replace(/<[^>]+>/g, "").trim()}`;
    });
  });

  // Handle unordered lists: bullet each <li>
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, liContent: string) => {
      return `\n• ${liContent.replace(/<[^>]+>/g, "").trim()}`;
    });
  });

  // Convert block elements to double newlines (paragraph breaks)
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/blockquote>/gi, "\n\n");

  // Convert <br> to single newline
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Convert <hr> to separator
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n /g, "\n");
  text = text.replace(/ \n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

function buildMailto(to: string, subject: string, body: string): string {
  const plainBody = htmlToPlainText(body);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

  if (mailto.length > 30000) {
    console.warn("[Email] mailto link is very long (" + mailto.length + " chars), may be truncated by email client");
  }

  return mailto;
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
  rawIntakeForm = null,
  autoReferralPartnerId = null,
}: EmailDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [step, setStep] = useState<"templates" | "partners" | "partner-detail" | "compose">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<ReferralPartner | null>(null);
  const [detailPartner, setDetailPartner] = useState<ReferralPartner | null>(null);
  const [compose, setCompose] = useState<{ partner: ReferralPartner | null; subject: string; bodyHtml: string; to: string[] } | null>(null);
  const [composed, setComposed] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoHandledRef = useRef<string | null>(null);

  // Effective template list — inject the built-in referral template if the user
  // hasn't created one, so the referral flow always works.
  const builtinReferral: EmailTemplate = {
    id: "builtin-referral",
    name: BUILTIN_REFERRAL_TEMPLATE.name,
    type: "referral",
    subjectTemplate: BUILTIN_REFERRAL_TEMPLATE.subjectTemplate,
    bodyTemplate: BUILTIN_REFERRAL_TEMPLATE.bodyTemplate,
    emailType: { color: "#F59E0B", isReferral: true },
  };
  // Offer the built-in table template until one of the user's own referral
  // templates adopts {{lead_data_table}} — then theirs takes over and the
  // built-in disappears from the list.
  const hasTableReferral = templates.some(
    (t) => isReferralTemplate(t) && t.bodyTemplate.includes("{{lead_data_table}}")
  );
  const allTemplates = hasTableReferral ? templates : [...templates, builtinReferral];

  // Refer Out flow: open straight into composing a referral email for a partner.
  useEffect(() => {
    if (!open || !autoReferralPartnerId) return;
    if (autoHandledRef.current === autoReferralPartnerId) return;
    const partner = referralPartners.find((p) => p.id === autoReferralPartnerId);
    // The partner's own template wins; else prefer a referral template with
    // the formatted data table.
    const tmpl =
      partner?.defaultEmailTemplate ??
      allTemplates.find((t) => isReferralTemplate(t) && t.bodyTemplate.includes("{{lead_data_table}}")) ??
      allTemplates.find(isReferralTemplate);
    if (!partner || !tmpl) return;
    autoHandledRef.current = autoReferralPartnerId;
    setSelectedTemplate(tmpl);
    composeEmail(tmpl, partner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoReferralPartnerId]);

  useEffect(() => {
    if (!open) autoHandledRef.current = null;
  }, [open]);

  if (!open) return null;

  // Render any template (referral or not) to a formatted, paste-ready email.
  function composeEmail(template: EmailTemplate, partner: ReferralPartner | null) {
    const rendered = renderTemplateEmail({
      lead,
      partner,
      assignedUserName,
      rawIntakeForm,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
    });
    setSelectedPartner(partner);
    setCompose({ partner, subject: rendered.subject, bodyHtml: rendered.bodyHtml, to: rendered.to });
    setComposed(false);
    setCopied(false);
    setStep("compose");
  }

  function handleSelectTemplate(template: EmailTemplate) {
    setSelectedTemplate(template);
    if (isReferralTemplate(template) && referralPartners.length > 0) {
      setStep("partners");
    } else {
      composeEmail(template, null);
    }
  }

  function handleSelectPartner(partner: ReferralPartner) {
    setSelectedPartner(partner);
    // A partner's own template wins over the generic referral template.
    const tmpl = partner.defaultEmailTemplate ?? selectedTemplate;
    if (tmpl) composeEmail(tmpl, partner);
  }

  function doCopy(): boolean {
    if (!compose) return false;
    return copyHtmlToClipboard(compose.bodyHtml);
  }

  // Primary path: copy the formatted email, then open a blank Outlook compose
  // (recipients + subject prefilled) so the user pastes the rich body in.
  async function copyAndOpenOutlook() {
    if (!compose) return;
    const ok = doCopy();
    setCopied(ok);
    // Outlook expects ';' between recipients — keep the separator unencoded so
    // it splits them into separate addresses instead of one mangled address.
    const mailto = `mailto:${compose.to.map(encodeURIComponent).join(";")}?subject=${encodeURIComponent(compose.subject)}`;
    window.open(mailto, "_self");
    setComposed(true);
    setIsPending(true);
    // A referral email keeps/sets REFERRED_OUT rather than flipping to CONTACTED.
    await logQuickAction(lead.id, compose.partner ? "referral_sent" : "contacted_email");
    setIsPending(false);
  }

  function copyOnly() {
    const ok = doCopy();
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  }

  function downloadComposedEml() {
    if (!compose) return;
    const eml = buildEml({
      to: compose.to.join(", "),
      subject: compose.subject,
      html: wrapEmailDocument(compose.bodyHtml),
    });
    downloadEml(emailFilename(lead, compose.partner), eml);
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
    setCompose(null);
    setComposed(false);
    setCopied(false);
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
            {step === "compose" && (selectedTemplate?.name ?? "Compose Email")}
          </h3>
          <button onClick={resetAndClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Step 1: Template Selection */}
          {step === "templates" && (
            <>
              {allTemplates.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">Choose a template:</p>
                  {allTemplates.map((tmpl) => {
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
                      {partner.contingencyRate && (
                        <p className="text-xs text-muted-foreground mt-0.5">Rate: {partner.contingencyRate}</p>
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
              {/* Financial Terms */}
              {(detailPartner.contingencyRate || detailPartner.upfrontCosts || detailPartner.paymentTerms || detailPartner.commissionStructure) && (
                <div>
                  <p className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Financial Terms</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailPartner.contingencyRate && <div><p className="text-muted-foreground text-xs">Contingency Rate</p><p className="font-medium">{detailPartner.contingencyRate}</p></div>}
                    {detailPartner.upfrontCosts && <div><p className="text-muted-foreground text-xs">Upfront Costs</p><p className="font-medium">{detailPartner.upfrontCosts}</p></div>}
                    {detailPartner.paymentTerms && <div><p className="text-muted-foreground text-xs">Payment Terms</p><p className="font-medium">{detailPartner.paymentTerms}</p></div>}
                    {detailPartner.commissionStructure && <div><p className="text-muted-foreground text-xs">Commission</p><p className="font-medium">{detailPartner.commissionStructure}</p></div>}
                  </div>
                </div>
              )}
              {/* Account Requirements */}
              {(detailPartner.minimumAccounts || detailPartner.minimumTotalBalance || detailPartner.avgAccountAgePref || detailPartner.accountTypesAccepted) && (
                <div>
                  <p className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Account Requirements</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailPartner.minimumAccounts != null && <div><p className="text-muted-foreground text-xs">Min Accounts</p><p className="font-medium">{detailPartner.minimumAccounts}</p></div>}
                    {detailPartner.minimumTotalBalance != null && <div><p className="text-muted-foreground text-xs">Min Total Balance</p><p className="font-medium">${detailPartner.minimumTotalBalance.toLocaleString()}</p></div>}
                    {detailPartner.avgAccountAgePref && <div><p className="text-muted-foreground text-xs">Preferred Age</p><p className="font-medium">{detailPartner.avgAccountAgePref}</p></div>}
                    {detailPartner.accountTypesAccepted && <div><p className="text-muted-foreground text-xs">Types Accepted</p><p className="font-medium">{detailPartner.accountTypesAccepted}</p></div>}
                  </div>
                </div>
              )}
              {/* Service Details */}
              {(detailPartner.collectionMethods || detailPartner.insuranceInfo || detailPartner.yearsInBusiness || detailPartner.complianceNotes) && (
                <div>
                  <p className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Service Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailPartner.collectionMethods && <div><p className="text-muted-foreground text-xs">Collection Methods</p><p className="font-medium">{detailPartner.collectionMethods}</p></div>}
                    {detailPartner.yearsInBusiness != null && <div><p className="text-muted-foreground text-xs">Years in Business</p><p className="font-medium">{detailPartner.yearsInBusiness}</p></div>}
                    {detailPartner.insuranceInfo && <div className="col-span-2"><p className="text-muted-foreground text-xs">Insurance</p><p className="font-medium">{detailPartner.insuranceInfo}</p></div>}
                    {detailPartner.complianceNotes && <div className="col-span-2"><p className="text-muted-foreground text-xs">Compliance</p><p className="font-medium">{detailPartner.complianceNotes}</p></div>}
                  </div>
                </div>
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

          {/* Step 4: Compose formatted email (copy into Outlook) */}
          {step === "compose" && compose && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">To: </span>
                  {compose.to.join("; ") || lead.email}
                </div>
                <div className="truncate">
                  <span className="text-muted-foreground">Subject: </span>
                  {compose.subject}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Preview:</p>
              <div className="rounded-lg border max-h-72 overflow-y-auto p-3 bg-white text-black">
                <div dangerouslySetInnerHTML={{ __html: compose.bodyHtml }} />
              </div>
              <div className="space-y-2">
                <button
                  onClick={copyAndOpenOutlook}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy email &amp; open Outlook
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyOnly}
                    className="flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy only"}
                  </button>
                  <button
                    onClick={downloadComposedEml}
                    className="flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    title="Opens a ready-made draft in classic Outlook desktop"
                  >
                    <FileDown className="h-4 w-4" />
                    Download .eml
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {composed
                  ? "Email copied. In the Outlook message that opened, click in the body and paste (Ctrl+V) — the formatting and table come through."
                  : "'Copy email & open Outlook' copies the formatted email and opens a new message — paste (Ctrl+V) into the body. 'Download .eml' opens a ready-made draft in classic Outlook desktop."}
                {composed && (
                  <button onClick={resetAndClose} className="ml-1 text-primary hover:underline">Done</button>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
