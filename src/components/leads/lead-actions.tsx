"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Handshake, CheckCircle, ThumbsUp, ThumbsDown, Download, MessageSquare, Copy, Merge, Printer, FileSignature, ChevronDown, ChevronRight } from "lucide-react";
import { updateLeadStatus } from "@/actions/lead.actions";
import { OnboardingDialog } from "@/components/leads/onboarding-dialog";
import type { MgmtType } from "@/actions/onboarding.actions";
import { logQuickAction, addNote } from "@/actions/note.actions";
import { exportLeadsCsv } from "@/actions/export.actions";
import { EmailDialog } from "@/components/leads/email-dialog";
import { MergeSearchDialog } from "@/components/leads/merge-search-dialog";
import { OutcomeModal } from "@/components/leads/outcome-modal";
import { toast } from "@/components/ui/use-toast";
import type { LeadStatus } from "@prisma/client";

const TERMINAL_STATUSES: Record<string, "won" | "lost" | "disqualified" | "referred_out"> = {
  WON: "won",
  LOST: "lost",
  DISQUALIFIED: "disqualified",
  REFERRED_OUT: "referred_out",
};

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

interface ReferralPartnerInfo {
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

interface LeadActionsProps {
  leadId: string;
  email: string | null;
  phone: string | null;
  currentStatus: LeadStatus;
  mailtoLink?: string;
  templates?: EmailTemplate[];
  referralPartners?: ReferralPartnerInfo[];
  leadData?: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    phone?: string | null;
    state?: string | null;
    states?: string[] | null;
    industry?: string | null;
    debtType?: string | null;
    businessType?: string | null;
    accountVolume?: string | null;
    title?: string | null;
    notesFromForm?: string | null;
    rawIntakeForm?: Record<string, unknown> | null;
  };
  assignedUserName?: string;
  /** Existing onboarding portal link, if one was created before. */
  onboardingPortalUrl?: string | null;
}

export function LeadActions({
  leadId,
  email,
  phone,
  currentStatus,
  mailtoLink,
  templates = [],
  referralPartners = [],
  leadData,
  assignedUserName,
  onboardingPortalUrl,
}: LeadActionsProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showMergeSearch, setShowMergeSearch] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [referralEmailPartnerId, setReferralEmailPartnerId] = useState<string | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<{ outcomeType: "won" | "lost" | "disqualified" | "referred_out"; targetStatus: LeadStatus } | null>(null);

  function handleEmailAction() {
    if (templates.length > 0 && email) {
      setShowEmailDialog(true);
    } else if (mailtoLink) {
      window.open(mailtoLink, "_self");
      startTransition(async () => {
        await logQuickAction(leadId, "contacted_email");
      });
    } else if (email) {
      window.open(`mailto:${email}`, "_self");
      startTransition(async () => {
        await logQuickAction(leadId, "contacted_email");
      });
    }
  }

  function handleCallAction() {
    if (phone) {
      window.open(`tel:${phone}`, "_self");
    }
    startTransition(async () => {
      await logQuickAction(leadId, "contacted_phone");
    });
  }

  function handleQuickLog(actionType: string, label: string) {
    startTransition(async () => {
      await logQuickAction(leadId, actionType);
      toast({ title: label, variant: "success" });
    });
  }

  function handleStatusChange(newStatus: LeadStatus) {
    // Intercept terminal statuses to show outcome modal first
    const outcomeType = TERMINAL_STATUSES[newStatus];
    if (outcomeType) {
      setOutcomeModal({ outcomeType, targetStatus: newStatus });
      return;
    }
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus);
      toast({ title: `Status changed to ${newStatus.replace(/_/g, " ")}`, variant: "success" });
    });
  }

  function handleCreateOnboarding() {
    setShowOnboarding(true);
  }

  // Derive the onboarding management type from the intake answer.
  const ownershipRaw = String(leadData?.rawIntakeForm?.ownershipType ?? "").toLowerCase();
  const mgmtType: MgmtType = ownershipRaw.includes("for others") || ownershipRaw.includes("third")
    ? "third_party"
    : ownershipRaw.includes("own")
      ? "owner_operator"
      : "";

  function handleOutcomeConfirm(result?: { referralPartnerId?: string }) {
    if (!outcomeModal) return;
    const targetStatus = outcomeModal.targetStatus;
    const wasReferral = outcomeModal.outcomeType === "referred_out";
    setOutcomeModal(null);
    startTransition(async () => {
      await updateLeadStatus(leadId, targetStatus);
      toast({ title: `Status changed to ${targetStatus.replace(/_/g, " ")}`, variant: "success" });
    });
    // After a refer-out with a chosen partner, offer the formatted referral email.
    if (wasReferral && result?.referralPartnerId && email) {
      setReferralEmailPartnerId(result.referralPartnerId);
      setShowEmailDialog(true);
    }
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    startTransition(async () => {
      await addNote(leadId, noteText.trim());
      setNoteText("");
      setShowNoteForm(false);
      toast({ title: "Note added", variant: "success" });
    });
  }

  function handleExport() {
    startTransition(async () => {
      const csv = await exportLeadsCsv([leadId]);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lead-${leadId}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const actionBtn =
    "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";
  const prominentBtn =
    "flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/10 disabled:opacity-50";

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
        Actions
      </h3>

      {/* Communication */}
      <div className="space-y-1.5">
        <button
          onClick={handleEmailAction}
          disabled={!email || isPending}
          className={prominentBtn}
        >
          <Mail className="h-4 w-4 text-blue-500" />
          Email Lead
        </button>
        <button
          onClick={handleCallAction}
          disabled={!phone || isPending}
          className={prominentBtn}
        >
          <Phone className="h-4 w-4 text-green-500" />
          Call Lead
        </button>
      </div>

      <div className="border-t" />

      {/* Status Actions */}
      <div className="space-y-1.5">
        <button
          onClick={() => handleQuickLog("contacted_email", "Marked as Contacted")}
          disabled={isPending}
          className={actionBtn}
        >
          <CheckCircle className="h-4 w-4 text-teal-500" />
          Mark Contacted
        </button>
        <button
          onClick={() => handleStatusChange("REFERRED_OUT" as LeadStatus)}
          disabled={isPending}
          className={actionBtn}
        >
          <Handshake className="h-4 w-4 text-orange-500" />
          Refer Out
        </button>
        <button
          onClick={() => handleStatusChange("QUALIFIED")}
          disabled={isPending}
          className={actionBtn}
        >
          <ThumbsUp className="h-4 w-4 text-emerald-500" />
          Qualified
        </button>
        <button
          onClick={() => handleStatusChange("DISQUALIFIED")}
          disabled={isPending}
          className={actionBtn}
        >
          <ThumbsDown className="h-4 w-4 text-red-500" />
          Disqualify
        </button>
      </div>

      <div className="border-t" />

      {/* Secondary actions, collapsed by default */}
      <button
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {moreOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        More actions
      </button>
      {moreOpen && (
      <div className="space-y-1.5">
        <button
          onClick={handleCreateOnboarding}
          disabled={isPending}
          className={actionBtn}
          title="Pre-create their profile in the onboarding tool and get the portal link"
        >
          <FileSignature className="h-4 w-4 text-blue-500" />
          Start Onboarding
        </button>
        <button
          onClick={() => handleQuickLog("duplicate_found", "Marked as Duplicate")}
          disabled={isPending}
          className={actionBtn}
        >
          <Copy className="h-4 w-4 text-yellow-600" />
          Mark Duplicate
        </button>
        <button
          onClick={handleExport}
          disabled={isPending}
          className={actionBtn}
        >
          <Download className="h-4 w-4 text-indigo-500" />
          Export for CRM
        </button>
        <button
          onClick={() => window.open(`/leads/${leadId}/print`, "_blank")}
          className={actionBtn}
        >
          <Printer className="h-4 w-4 text-slate-500" />
          Print / PDF
        </button>
        <button
          onClick={() => setShowMergeSearch(true)}
          className={actionBtn}
        >
          <Merge className="h-4 w-4 text-gray-500" />
          Find & Merge
        </button>
        <button
          onClick={() => setShowNoteForm(!showNoteForm)}
          className={actionBtn}
        >
          <MessageSquare className="h-4 w-4 text-purple-500" />
          Add Note
        </button>
      </div>
      )}

      <div className="border-t" />

      {/* Status Change — always visible, shows the current status */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Lead Status
        </label>
        <select
          className="w-full rounded-md border border-input bg-card p-2 text-sm font-medium"
          value={currentStatus}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
        >
          {[
            "NEW",
            "REVIEWED",
            "QUALIFIED",
            "CONTACTED",
            "FOLLOW_UP_NEEDED",
            "REFERRED_OUT",
            "IMPORTED_TO_CRM",
            "WON",
            "LOST",
            "DISQUALIFIED",
            "DUPLICATE",
            "ARCHIVED",
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Changing to Won, Lost, Disqualified, or Referred Out asks for the outcome details first.
        </p>
      </div>

      {/* Note Form */}
      {showNoteForm && (
        <div className="space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Type your note..."
            className="w-full rounded-md border border-input bg-card p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddNote}
              disabled={isPending || !noteText.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Save Note
            </button>
            <button
              onClick={() => {
                setShowNoteForm(false);
                setNoteText("");
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Email Dialog */}
      {email && (
        <EmailDialog
          open={showEmailDialog}
          onClose={() => { setShowEmailDialog(false); setReferralEmailPartnerId(null); }}
          lead={{
            id: leadId,
            email,
            fullName: leadData?.fullName,
            firstName: leadData?.firstName,
            lastName: leadData?.lastName,
            companyName: leadData?.companyName,
            phone: leadData?.phone ?? phone,
            state: leadData?.state,
            states: leadData?.states,
            industry: leadData?.industry,
            debtType: leadData?.debtType,
            businessType: leadData?.businessType,
            accountVolume: leadData?.accountVolume,
            title: leadData?.title,
            notesFromForm: leadData?.notesFromForm,
          }}
          templates={templates}
          assignedUserName={assignedUserName}
          referralPartners={referralPartners}
          rawIntakeForm={leadData?.rawIntakeForm ?? null}
          autoReferralPartnerId={referralEmailPartnerId}
        />
      )}

      {showOnboarding && (
        <OnboardingDialog
          open={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          leadId={leadId}
          existingPortalUrl={onboardingPortalUrl ?? null}
          prefill={{
            companyName: leadData?.companyName ?? "",
            contactName: leadData?.fullName ?? "",
            email: email ?? "",
            phone: leadData?.phone ?? phone ?? "",
            mgmtType,
          }}
        />
      )}

      <MergeSearchDialog
        open={showMergeSearch}
        onClose={() => setShowMergeSearch(false)}
        currentLeadId={leadId}
      />

      {outcomeModal && (
        <OutcomeModal
          open={true}
          onClose={() => setOutcomeModal(null)}
          onConfirm={handleOutcomeConfirm}
          leadId={leadId}
          outcomeType={outcomeModal.outcomeType}
          referralPartners={referralPartners.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
