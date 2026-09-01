"use client";

import { useState, useTransition } from "react";
import { format, toZonedTime } from "date-fns-tz";
import { addNote } from "@/actions/note.actions";
import { toast } from "@/components/ui/use-toast";
import { SubmissionDataTable } from "./submission-data-table";

interface TimelineEvent {
  id: string;
  createdAt: Date;
  eventType: string;
  eventDataJson: unknown;
  user: { id: string; name: string } | null;
}

interface NoteItem {
  id: string;
  noteBody: string;
  createdAt: Date;
  user: { id: string; name: string };
}

const eventLabels: Record<string, string> = {
  lead_created: "Lead created",
  score_calculated: "Score calculated",
  status_changed: "Status changed",
  note_added: "Note added",
  email_action_opened: "Email action opened",
  call_action_opened: "Call action opened",
  referral_action_opened: "Referral action opened",
  referral_marked_sent: "Referral marked as sent",
  crm_exported: "Exported for CRM",
  crm_imported: "Imported to CRM",
  duplicate_flagged: "Duplicate flagged",
  assigned_user_changed: "Assignment changed",
  quick_log: "Quick log action",
  research_completed: "Research completed",
  auto_research: "Auto research ran",
  prospect_comment: "Comment from the prospect",
  lead_data_received: "Submission Data Received",
};

function formatEventDetail(event: TimelineEvent): string | null {
  const data = event.eventDataJson as Record<string, unknown> | null;
  if (!data) return null;

  if (event.eventType === "status_changed") {
    return `${String(data.from ?? "").replace(/_/g, " ")} → ${String(data.to ?? "").replace(/_/g, " ")}`;
  }
  if (event.eventType === "score_calculated") {
    return `Score: ${data.score} (${data.qualityTier})`;
  }
  if (event.eventType === "quick_log") {
    return String(data.actionType ?? "").replace(/_/g, " ");
  }
  if (event.eventType === "duplicate_flagged" && Array.isArray(data.matches)) {
    return `${data.matches.length} potential duplicate(s) found`;
  }
  if (event.eventType === "research_completed") {
    const d = data as { recommendation?: string; sources?: string[] };
    return d.recommendation ? `Recommendation: ${d.recommendation}` : null;
  }
  if (event.eventType === "prospect_comment") {
    return typeof data.comment === "string" ? data.comment : null;
  }
  if (event.eventType === "auto_research") {
    const d = data as { domain?: string; profiles?: Array<{ kind: string }> };
    const found = d.profiles?.length ?? 0;
    return `Read ${d.domain ?? "their site"}; found ${found} linked profile${found !== 1 ? "s" : ""}`;
  }
  if (event.eventType === "lead_edited" && Array.isArray(data.changes)) {
    const changes = data.changes as Array<{ field: string; from?: string | null; to?: string | null }>;
    return changes
      .map((c) => `${c.field}: "${c.from ?? "empty"}" → "${c.to ?? "empty"}"`)
      .join(" · ");
  }
  if (event.eventType === "recapture_email_sent") {
    return `Recapture email ${data.step ?? ""}: ${data.subject ?? ""}`;
  }
  if (event.eventType === "confirmation_email_sent") {
    return `Confirmation sent to ${data.to ?? ""}${data.isHot ? " (high value)" : ""}`;
  }
  if (event.eventType === "recapture_link_opened") {
    return "Opened their resume link from a recapture email";
  }
  if (event.eventType === "onboarding_profile_created") {
    return `Portal: ${data.portalUrl ?? ""}`;
  }
  if (event.eventType === "prospect_updated_details") {
    return data.wasAbandoned
      ? "Finished the form they had abandoned; lead updated and rescored"
      : "Updated their details through the edit link; lead rescored";
  }
  if (event.eventType === "edit_link_opened") {
    return "Opened the edit link from their confirmation email";
  }
  if (event.eventType.startsWith("email_")) {
    return `${event.eventType.replace("email_", "Email ").replace(/_/g, " ")}${data.subject ? `: ${data.subject}` : ""}`;
  }
  return null;
}

const EST_TZ = "America/New_York";

function formatEST(date: Date): string {
  const zoned = toZonedTime(date, EST_TZ);
  return format(zoned, "MMM d, yyyy h:mm a", { timeZone: EST_TZ }) + " EST";
}

// Preset filter categories. "Prospect" is anything the lead themselves did.
type FilterKey = "all" | "notes" | "emails" | "prospect" | "status" | "team" | "system";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "emails", label: "Emails" },
  { key: "prospect", label: "Prospect" },
  { key: "status", label: "Status" },
  { key: "team", label: "Team" },
  { key: "system", label: "System" },
];

const PROSPECT_EVENTS = new Set([
  "lead_data_received",
  "recapture_link_opened",
  "edit_link_opened",
  "prospect_updated_details",
  "prospect_comment",
]);
const SYSTEM_EVENTS = new Set(["lead_created", "score_calculated", "duplicate_flagged"]);

function eventCategory(eventType: string): Exclude<FilterKey, "all" | "notes"> {
  if (eventType === "note_added") return "team";
  if (eventType.includes("email")) return "emails";
  if (PROSPECT_EVENTS.has(eventType)) return "prospect";
  if (eventType === "status_changed") return "status";
  if (SYSTEM_EVENTS.has(eventType)) return "system";
  return "team";
}

const CATEGORY_DOT: Record<string, string> = {
  notes: "bg-purple-400",
  emails: "bg-blue-400",
  prospect: "bg-emerald-500",
  status: "bg-amber-400",
  team: "bg-slate-400",
  system: "bg-muted-foreground/40",
};

interface ActivityTimelineProps {
  events: TimelineEvent[];
  notes?: NoteItem[];
  leadId?: string;
  stateClassMap?: Record<string, string>;
}

export function ActivityTimeline({ events, notes = [], leadId, stateClassMap }: ActivityTimelineProps) {
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isPending, startTransition] = useTransition();

  // Merge events and notes into a single timeline, newest first
  const allItems = [
    ...events.map((e) => ({
      type: "event" as const,
      id: e.id,
      date: new Date(e.createdAt),
      category: eventCategory(e.eventType),
      data: e,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      date: new Date(n.createdAt),
      category: "notes" as const,
      data: n,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const counts: Record<string, number> = { all: allItems.length };
  for (const item of allItems) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }

  const merged = filter === "all" ? allItems : allItems.filter((i) => i.category === filter);

  function handleAddNote() {
    if (!noteText.trim() || !leadId) return;
    startTransition(async () => {
      await addNote(leadId, noteText.trim());
      setNoteText("");
      toast({ title: "Note added", variant: "success" });
    });
  }

  return (
    <div>
      {/* Inline note input */}
      {leadId && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
            placeholder="Add a note..."
            className="flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isPending}
          />
          <button
            onClick={handleAddNote}
            disabled={isPending || !noteText.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = counts[f.key] ?? 0;
          if (f.key !== "all" && count === 0) return null;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f.label}
              <span className={`ml-1 ${active ? "text-primary/70" : "text-muted-foreground/60"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div className="max-h-[70vh] overflow-y-auto">
        {merged.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No activity in this view</p>
        ) : (
          <div className="space-y-0">
            {merged.map((item) => {
              if (item.type === "note") {
                const note = item.data as NoteItem;
                return (
                  <div key={`note-${item.id}`} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-purple-400 mt-1.5" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div className="pb-3">
                      <p className="text-xs text-muted-foreground">
                        {formatEST(item.date)}
                        <span className="ml-1">— {note.user.name}</span>
                      </p>
                      <p className="font-medium mt-0.5">Note added</p>
                      <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{note.noteBody}</p>
                    </div>
                  </div>
                );
              }

              const event = item.data as TimelineEvent;
              const detail = formatEventDetail(event);
              return (
                <div key={`evt-${item.id}`} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={`h-2 w-2 rounded-full mt-1.5 ${CATEGORY_DOT[item.category] ?? "bg-muted-foreground/40"}`} />
                    <div className="w-px flex-1 bg-border" />
                  </div>
                  <div className="pb-3">
                    <p className="text-xs text-muted-foreground">
                      {formatEST(item.date)}
                      {event.user && <span className="ml-1">— {event.user.name}</span>}
                      {!event.user && <span className="ml-1">— System</span>}
                    </p>
                    <p className="font-medium mt-0.5">
                      {eventLabels[event.eventType] ?? event.eventType}
                    </p>
                    {event.eventType === "lead_data_received" ? (
                      <SubmissionDataTable
                        data={event.eventDataJson as { fields: Record<string, unknown>; metadata: Record<string, unknown> }}
                        stateClassMap={stateClassMap}
                      />
                    ) : (
                      detail && <p className="text-muted-foreground mt-0.5">{detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
