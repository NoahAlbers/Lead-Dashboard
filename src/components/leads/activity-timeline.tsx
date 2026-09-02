"use client";

import { useState, useTransition } from "react";
import { format, toZonedTime } from "date-fns-tz";
import { ChevronDown, ChevronRight, FileSignature } from "lucide-react";
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

function zoned(date: Date) {
  return toZonedTime(date, EST_TZ);
}
function formatTime(date: Date): string {
  return format(zoned(date), "h:mm a", { timeZone: EST_TZ });
}
function dayKey(date: Date): string {
  return format(zoned(date), "yyyy-MM-dd", { timeZone: EST_TZ });
}
function dayLabel(date: Date): string {
  const key = dayKey(date);
  const now = new Date();
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86400000))) return "Yesterday";
  const z = zoned(date);
  const sameYear = z.getFullYear() === zoned(now).getFullYear();
  return format(z, sameYear ? "EEE, MMM d" : "EEE, MMM d, yyyy", { timeZone: EST_TZ });
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

type Category = Exclude<FilterKey, "all">;

interface BaseItem {
  id: string;
  date: Date;
  category: Category;
}
interface EventItem extends BaseItem { type: "event"; data: TimelineEvent }
interface NoteEntry extends BaseItem { type: "note"; data: NoteItem }
/** Several onboarding events close together, shown as one collapsible line. */
interface GroupItem extends BaseItem { type: "onboarding_group"; items: EventItem[] }
type Item = EventItem | NoteEntry | GroupItem;

const ONBOARDING_GAP_MS = 12 * 60 * 60 * 1000;

function isOnboarding(e: TimelineEvent) {
  return e.eventType.startsWith("onboarding_");
}

/** Fold runs of onboarding events (within 12 hours of each other) into one group. */
function groupOnboarding(items: Array<EventItem | NoteEntry>): Item[] {
  const out: Item[] = [];
  let run: EventItem[] = [];
  const flush = () => {
    if (run.length >= 2) {
      out.push({ type: "onboarding_group", id: `grp-${run[0].id}`, date: run[0].date, category: "prospect", items: run });
    } else if (run.length === 1) {
      out.push(run[0]);
    }
    run = [];
  };
  for (const item of items) {
    if (item.type === "event" && isOnboarding(item.data)) {
      const last = run[run.length - 1];
      if (last && last.date.getTime() - item.date.getTime() > ONBOARDING_GAP_MS) flush();
      run.push(item);
    } else {
      flush();
      out.push(item);
    }
  }
  flush();
  return out;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  notes?: NoteItem[];
  leadId?: string;
  stateClassMap?: Record<string, string>;
}

export function ActivityTimeline({ events, notes = [], leadId, stateClassMap }: ActivityTimelineProps) {
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // Merge events and notes into a single timeline, newest first.
  // note_added events are bookkeeping; the note itself is rendered below.
  const visibleEvents = events.filter((e) => e.eventType !== "note_added");
  const flat: Array<EventItem | NoteEntry> = [
    ...visibleEvents.map<EventItem>((e) => ({ type: "event", id: e.id, date: new Date(e.createdAt), category: eventCategory(e.eventType), data: e })),
    ...notes.map<NoteEntry>((n) => ({ type: "note", id: n.id, date: new Date(n.createdAt), category: "notes", data: n })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const counts: Record<string, number> = { all: flat.length };
  for (const item of flat) counts[item.category] = (counts[item.category] || 0) + 1;

  const filtered = filter === "all" ? flat : flat.filter((i) => i.category === filter);
  const merged = groupOnboarding(filtered);

  function handleAddNote() {
    if (!noteText.trim() || !leadId) return;
    startTransition(async () => {
      await addNote(leadId, noteText.trim());
      setNoteText("");
      toast({ title: "Note added", variant: "success" });
    });
  }

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // Rows: a fixed time column, the category dot with its connector line, then the content.
  const Row = ({ item, dot, children }: { item: BaseItem; dot: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[58px_14px_1fr] gap-x-2 text-sm">
      <div className="pt-0.5 text-right text-[11px] tabular-nums text-muted-foreground">{formatTime(item.date)}</div>
      <div className="flex flex-col items-center">
        <div className={`mt-1.5 h-2 w-2 rounded-full ${dot}`} />
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="min-w-0 pb-3">{children}</div>
    </div>
  );

  const Who = ({ name }: { name: string | null }) => (
    <span className="ml-1.5 text-[11px] text-muted-foreground">{name ?? "System"}</span>
  );

  let lastDay: string | null = null;

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
                active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
          <div>
            {merged.map((item) => {
              const day = dayKey(item.date);
              const header = day !== lastDay ? (
                <div className="sticky top-0 z-10 -mx-1 mb-1.5 mt-1 bg-card/95 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur first:mt-0">
                  {dayLabel(item.date)}
                </div>
              ) : null;
              lastDay = day;

              if (item.type === "note") {
                const note = item.data;
                return (
                  <div key={`note-${item.id}`}>
                    {header}
                    <Row item={item} dot="bg-purple-400">
                      <p className="font-medium leading-snug">Note<Who name={note.user.name} /></p>
                      <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{note.noteBody}</p>
                    </Row>
                  </div>
                );
              }

              if (item.type === "onboarding_group") {
                const isOpen = !!open[item.id];
                const newest = item.items[0].data;
                const oldest = item.items[item.items.length - 1];
                const newestDetail = formatEventDetail(newest);
                return (
                  <div key={item.id}>
                    {header}
                    <Row item={item} dot="bg-emerald-500">
                      <button type="button" onClick={() => toggle(item.id)} className="flex w-full items-start gap-1.5 text-left">
                        {isOpen ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0">
                          <span className="font-medium leading-snug">
                            <FileSignature className="mr-1 inline h-3.5 w-3.5 text-blue-500" />
                            Onboarding · {item.items.length} updates
                          </span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {formatTime(oldest.date)} to {formatTime(item.date)}
                          </span>
                          {!isOpen && newestDetail && (
                            <span className="block truncate text-muted-foreground">Latest: {newestDetail}</span>
                          )}
                        </span>
                      </button>
                      {isOpen && (
                        <ul className="mt-1.5 space-y-1 border-l pl-3">
                          {item.items.map((sub) => {
                            const d = formatEventDetail(sub.data);
                            return (
                              <li key={sub.id} className="text-xs">
                                <span className="tabular-nums text-muted-foreground">{formatTime(sub.date)}</span>
                                <span className="ml-2 font-medium">{eventLabels[sub.data.eventType] ?? sub.data.eventType}</span>
                                {d && <span className="ml-1 text-muted-foreground">{d}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Row>
                  </div>
                );
              }

              const event = item.data;
              const detail = formatEventDetail(event);
              const isSubmission = event.eventType === "lead_data_received";
              const showSubmission = !!open[item.id];
              return (
                <div key={`evt-${item.id}`}>
                  {header}
                  <Row item={item} dot={CATEGORY_DOT[item.category] ?? "bg-muted-foreground/40"}>
                    <p className="leading-snug">
                      <span className="font-medium">{eventLabels[event.eventType] ?? event.eventType}</span>
                      <Who name={event.user?.name ?? null} />
                    </p>
                    {isSubmission ? (
                      <>
                        <button type="button" onClick={() => toggle(item.id)} className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          {showSubmission ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {showSubmission ? "Hide submission" : "Show submission"}
                        </button>
                        {showSubmission && (
                          <SubmissionDataTable
                            data={event.eventDataJson as { fields: Record<string, unknown>; metadata: Record<string, unknown> }}
                            stateClassMap={stateClassMap}
                          />
                        )}
                      </>
                    ) : (
                      detail && <p className="mt-0.5 text-muted-foreground line-clamp-2">{detail}</p>
                    )}
                  </Row>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
