"use client";

import { useState, useTransition } from "react";
import { format, toZonedTime } from "date-fns-tz";
import { addNote } from "@/actions/note.actions";
import { toast } from "@/components/ui/use-toast";
import { SubmissionDataTable } from "./submission-data-table";
import { eventLabels, formatEventDetail } from "@/lib/event-detail";

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
  "email_reply_received",
  "recapture_link_opened",
  "edit_link_opened",
  "prospect_updated_details",
  "prospect_comment",
  "onboarding_milestone",
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
  // note_added events are bookkeeping; the note itself is rendered below.
  const visibleEvents = events.filter((e) => e.eventType !== "note_added");
  const allItems = [
    ...visibleEvents.map((e) => ({
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
