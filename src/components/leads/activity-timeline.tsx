"use client";

import { useState, useTransition } from "react";
import { format, toZonedTime } from "date-fns-tz";
import { addNote } from "@/actions/note.actions";
import { toast } from "@/components/ui/use-toast";

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
};

function formatEventDetail(event: TimelineEvent): string | null {
  const data = event.eventDataJson as Record<string, unknown> | null;
  if (!data) return null;

  if (event.eventType === "status_changed") {
    return `${String(data.from ?? "").replace(/_/g, " ")} → ${String(data.to ?? "").replace(/_/g, " ")}`;
  }
  if (event.eventType === "score_calculated") {
    return `Score: ${data.score} (${data.qualityTier} Lead)`;
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
  return null;
}

const EST_TZ = "America/New_York";

function formatEST(date: Date): string {
  const zoned = toZonedTime(date, EST_TZ);
  return format(zoned, "MMM d, yyyy h:mm a", { timeZone: EST_TZ }) + " EST";
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  notes?: NoteItem[];
  leadId?: string;
}

export function ActivityTimeline({ events, notes = [], leadId }: ActivityTimelineProps) {
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();

  // Merge events and notes into a single timeline, newest first
  const merged = [
    ...events.map((e) => ({ type: "event" as const, id: e.id, date: new Date(e.createdAt), data: e })),
    ...notes.map((n) => ({ type: "note" as const, id: n.id, date: new Date(n.createdAt), data: n })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

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

      {/* Scrollable timeline */}
      <div className="max-h-[500px] overflow-y-auto">
        {merged.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No activity yet</p>
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
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5" />
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
                    {detail && <p className="text-muted-foreground mt-0.5">{detail}</p>}
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
