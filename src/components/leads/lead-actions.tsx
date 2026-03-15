"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Handshake,
  CheckCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Download,
  MessageSquare,
  Copy,
  Merge,
} from "lucide-react";
import { updateLeadStatus } from "@/actions/lead.actions";
import { logQuickAction, addNote } from "@/actions/note.actions";
import { exportLeadsCsv } from "@/actions/export.actions";
import { EmailDialog } from "@/components/leads/email-dialog";
import { MergeSearchDialog } from "@/components/leads/merge-search-dialog";
import { toast } from "@/components/ui/use-toast";
import type { LeadStatus } from "@prisma/client";

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
    companyName?: string | null;
    phone?: string | null;
    state?: string | null;
    industry?: string | null;
    notesFromForm?: string | null;
  };
  assignedUserName?: string;
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
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showStatusSelect, setShowStatusSelect] = useState(false);
  const [showMergeSearch, setShowMergeSearch] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

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
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus);
      setShowStatusSelect(false);
      toast({ title: `Status changed to ${newStatus.replace(/_/g, " ")}`, variant: "success" });
    });
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

  const actionBtnClass =
    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Actions
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleEmailAction}
          disabled={!email || isPending}
          className={actionBtnClass}
        >
          <Mail className="h-4 w-4 text-blue-500" />
          Email Lead
        </button>

        <button
          onClick={handleCallAction}
          disabled={!phone || isPending}
          className={actionBtnClass}
        >
          <Phone className="h-4 w-4 text-green-500" />
          Call Lead
        </button>

        <button
          onClick={() => handleQuickLog("contacted_email", "Marked as Contacted")}
          disabled={isPending}
          className={actionBtnClass}
        >
          <CheckCircle className="h-4 w-4 text-teal-500" />
          Mark Contacted
        </button>

        <button
          onClick={() => handleQuickLog("follow_up_scheduled", "Marked for Follow-Up")}
          disabled={isPending}
          className={actionBtnClass}
        >
          <Clock className="h-4 w-4 text-amber-500" />
          Follow-Up Needed
        </button>

        <button
          onClick={() => handleStatusChange("QUALIFIED")}
          disabled={isPending}
          className={actionBtnClass}
        >
          <ThumbsUp className="h-4 w-4 text-emerald-500" />
          Mark Qualified
        </button>

        <button
          onClick={() => handleStatusChange("DISQUALIFIED")}
          disabled={isPending}
          className={actionBtnClass}
        >
          <ThumbsDown className="h-4 w-4 text-red-500" />
          Disqualify
        </button>

        <button
          onClick={() => handleQuickLog("referral_sent", "Marked as Referred")}
          disabled={isPending}
          className={actionBtnClass}
        >
          <Handshake className="h-4 w-4 text-orange-500" />
          Refer Out
        </button>

        <button
          onClick={() => handleQuickLog("duplicate_found", "Marked as Duplicate")}
          disabled={isPending}
          className={actionBtnClass}
        >
          <Copy className="h-4 w-4 text-yellow-600" />
          Mark Duplicate
        </button>

        <button
          onClick={handleExport}
          disabled={isPending}
          className={actionBtnClass}
        >
          <Download className="h-4 w-4 text-indigo-500" />
          Export for CRM
        </button>

        <button
          onClick={() => setShowMergeSearch(true)}
          className={actionBtnClass}
        >
          <Merge className="h-4 w-4 text-gray-500" />
          Find & Merge
        </button>

        <button
          onClick={() => setShowNoteForm(!showNoteForm)}
          className={actionBtnClass}
        >
          <MessageSquare className="h-4 w-4 text-purple-500" />
          Add Note
        </button>
      </div>

      {/* Status Change */}
      <div>
        <button
          onClick={() => setShowStatusSelect(!showStatusSelect)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Change Status...
        </button>
        {showStatusSelect && (
          <select
            className="mt-2 w-full rounded-md border border-input bg-card p-2 text-sm"
            value={currentStatus}
            onChange={(e) =>
              handleStatusChange(e.target.value as LeadStatus)
            }
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
        )}
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
          onClose={() => setShowEmailDialog(false)}
          lead={{
            id: leadId,
            email,
            fullName: leadData?.fullName,
            companyName: leadData?.companyName,
            phone: leadData?.phone ?? phone,
            state: leadData?.state,
            industry: leadData?.industry,
            notesFromForm: leadData?.notesFromForm,
          }}
          templates={templates}
          assignedUserName={assignedUserName}
          referralPartners={referralPartners}
        />
      )}

      <MergeSearchDialog
        open={showMergeSearch}
        onClose={() => setShowMergeSearch(false)}
        currentLeadId={leadId}
      />
    </div>
  );
}
