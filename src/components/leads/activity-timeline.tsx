"use client";

import { useState, useTransition } from "react";
import { format, toZonedTime } from "date-fns-tz";
import {
  Bot,
  CalendarClock,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  FileSignature,
  FileText,
  Gauge,
  Handshake,
  Mail,
  MailCheck,
  MailOpen,
  MessageSquare,
  Pencil,
  Phone,
  Repeat,
  Search,
  StickyNote,
  UserCheck,
  UserPlus,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { addNote } from "@/actions/note.actions";
import { updateInteractionNote } from "@/actions/interaction.actions";
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
function dayKey(date: Date): string {
  return format(zoned(date), "yyyy-MM-dd", { timeZone: EST_TZ });
}
/** "Today 3:52 PM", "Yesterday 11:07 AM", "Sep 1, 10:12 AM" — every row says
 *  when it happened on its own, so the list needs no date headings. */
function whenLabel(date: Date): string {
  const time = format(zoned(date), "h:mm a", { timeZone: EST_TZ });
  const key = dayKey(date);
  const now = new Date();
  if (key === dayKey(now)) return `Today ${time}`;
  if (key === dayKey(new Date(now.getTime() - 86400000))) return `Yesterday ${time}`;
  const z = zoned(date);
  const sameYear = z.getFullYear() === zoned(now).getFullYear();
  return `${format(z, sameYear ? "MMM d" : "MMM d, yyyy", { timeZone: EST_TZ })}, ${time}`;
}

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
  if (eventType.startsWith("contact_")) return "team";
  if (eventType === "interaction_logged") return "team";
  if (eventType.includes("email")) return "emails";
  if (PROSPECT_EVENTS.has(eventType)) return "prospect";
  if (eventType === "status_changed") return "status";
  if (SYSTEM_EVENTS.has(eventType)) return "system";
  return "team";
}

/**
 * How loudly each kind of entry speaks.
 *
 * Only the things somebody scanning an account actually asks about get colour:
 * has this person been contacted, when, what came of it, and is anything
 * booked next. Everything the system did to itself stays quiet.
 */
type Tone = "note" | "contact" | "status" | "schedule" | "prospect" | "quiet";

const TONE_STYLES: Record<Tone, { dot: string; card: string }> = {
  note: {
    dot: "bg-blue-50 text-blue-600 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
    card: "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30",
  },
  contact: {
    dot: "bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    card: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
  },
  status: {
    dot: "bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    card: "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
  },
  schedule: {
    dot: "bg-violet-50 text-violet-600 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
    card: "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30",
  },
  prospect: {
    dot: "bg-sky-50 text-sky-600 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
    card: "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30",
  },
  quiet: {
    dot: "bg-muted text-muted-foreground ring-border",
    card: "border-transparent bg-transparent",
  },
};

/** Icon, tone, and the plain sentence shown when the icon is hovered. */
const EVENT_STYLE: Record<string, { icon: LucideIcon; tone: Tone; hint: string }> = {
  interaction_logged: { icon: Phone, tone: "contact", hint: "A call or email somebody on the team logged by hand" },
  contact_added: { icon: UserPlus, tone: "quiet", hint: "Another person at this account was added" },
  contact_updated: { icon: UserPlus, tone: "quiet", hint: "Details for one of the extra contacts were changed" },
  contact_removed: { icon: UserPlus, tone: "quiet", hint: "One of the extra contacts was removed" },
  first_contact_recorded: { icon: UserCheck, tone: "contact", hint: "The first time anyone reached this person" },
  email_reply_received: { icon: MailOpen, tone: "contact", hint: "The prospect wrote back" },
  quick_log: { icon: CircleDot, tone: "contact", hint: "A quick action somebody logged from the lead page" },
  status_changed: { icon: Repeat, tone: "status", hint: "The lead moved from one status to another" },
  follow_up_scheduled: { icon: CalendarClock, tone: "schedule", hint: "Somebody booked a follow-up for later" },
  follow_up_due: { icon: CalendarClock, tone: "schedule", hint: "A booked follow-up came due" },
  follow_up_completed: { icon: CalendarCheck, tone: "schedule", hint: "A follow-up was marked done" },
  follow_up_cancelled: { icon: CalendarClock, tone: "quiet", hint: "A booked follow-up was called off" },
  note_added: { icon: StickyNote, tone: "note", hint: "A note somebody on the team wrote" },
  prospect_comment: { icon: MessageSquare, tone: "prospect", hint: "Something the prospect typed into the form" },
  lead_data_received: { icon: FileText, tone: "prospect", hint: "What they submitted on the intake form" },
  prospect_updated_details: { icon: FileText, tone: "prospect", hint: "The prospect came back and changed their answers" },
  recapture_link_opened: { icon: MailOpen, tone: "prospect", hint: "They opened the link from a recapture email" },
  edit_link_opened: { icon: MailOpen, tone: "prospect", hint: "They opened the edit link from their confirmation email" },
  onboarding_milestone: { icon: FileSignature, tone: "prospect", hint: "Progress inside their onboarding portal" },
  onboarding_profile_created: { icon: FileSignature, tone: "contact", hint: "Their onboarding portal was created" },
  confirmation_email_sent: { icon: MailCheck, tone: "quiet", hint: "The automatic confirmation email went out" },
  confirmation_email_failed: { icon: Mail, tone: "quiet", hint: "The confirmation email could not be sent" },
  recapture_email_sent: { icon: Mail, tone: "quiet", hint: "An automated recapture email went out" },
  recapture_email_failed: { icon: Mail, tone: "quiet", hint: "A recapture email could not be sent" },
  recapture_stopped: { icon: Mail, tone: "quiet", hint: "The recapture sequence was stopped" },
  referral_marked_sent: { icon: Handshake, tone: "contact", hint: "The lead was handed to a referral partner" },
  referral_action_opened: { icon: Handshake, tone: "quiet", hint: "Somebody opened the referral flow" },
  auto_research: { icon: Bot, tone: "quiet", hint: "The system read their website on its own" },
  research_completed: { icon: Search, tone: "quiet", hint: "Research somebody ran and saved" },
  score_calculated: { icon: Gauge, tone: "quiet", hint: "The scoring rules ran" },
  lead_created: { icon: FileText, tone: "quiet", hint: "The lead record was created" },
  lead_edited: { icon: Pencil, tone: "quiet", hint: "Somebody edited the lead's details" },
  assigned_user_changed: { icon: UserCog, tone: "quiet", hint: "The lead changed hands" },
  duplicate_flagged: { icon: Copy, tone: "quiet", hint: "A possible duplicate was spotted" },
  leads_merged: { icon: Users, tone: "quiet", hint: "Two leads were merged together" },
};

const DEFAULT_STYLE = { icon: CircleDot, tone: "quiet" as Tone, hint: "Something happened on this lead" };

function styleFor(eventType: string, data: unknown) {
  const base = EVENT_STYLE[eventType] ?? DEFAULT_STYLE;
  // A logged email should look like an email, not a phone call.
  if (eventType === "interaction_logged") {
    const kind = (data as { kind?: string } | null)?.kind;
    if (kind === "email") return { ...base, icon: Mail };
  }
  return base;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  notes?: NoteItem[];
  leadId?: string;
  stateClassMap?: Record<string, string>;
  /** Who is looking, so their own logged calls can be edited in place. */
  currentUserId?: string | null;
  isAdmin?: boolean;
}

export function ActivityTimeline({
  events,
  notes = [],
  leadId,
  stateClassMap,
  currentUserId = null,
  isAdmin = false,
}: ActivityTimelineProps) {
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleEvents = events.filter((e) => e.eventType !== "note_added");
  const flat = [
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

  const counts: Record<string, number> = { all: flat.length };
  for (const item of flat) counts[item.category] = (counts[item.category] || 0) + 1;
  const merged = filter === "all" ? flat : flat.filter((i) => i.category === filter);

  function handleAddNote() {
    if (!noteText.trim() || !leadId) return;
    startTransition(async () => {
      await addNote(leadId, noteText.trim());
      setNoteText("");
      toast({ title: "Note added", variant: "success" });
    });
  }

  function saveInteractionNote(eventId: string) {
    startTransition(async () => {
      const res = await updateInteractionNote(eventId, draft);
      if (!res.success) {
        toast({ title: "Not saved", description: res.error, variant: "destructive" });
        return;
      }
      setEditing(null);
      toast({ title: "Notes saved", variant: "success" });
    });
  }

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  /** One entry: the icon rail on the left, the thing that happened on the right. */
  const Row = ({
    icon: Icon,
    tone,
    hint,
    children,
  }: {
    icon: LucideIcon;
    tone: Tone;
    hint: string;
    children: React.ReactNode;
  }) => {
    const styles = TONE_STYLES[tone];
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <span
            title={hint}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${styles.dot}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="mt-1 w-px flex-1 bg-border" />
        </div>
        <div className="min-w-0 flex-1 pb-3">{children}</div>
      </div>
    );
  };

  return (
    <div className="min-w-0">
      {leadId && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
            placeholder="Add a note..."
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isPending}
          />
          <button
            onClick={handleAddNote}
            disabled={isPending || !noteText.trim()}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

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
                active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
              <span className={`ml-1 ${active ? "text-primary/70" : "text-muted-foreground/60"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Vertical scrolling only: nothing in here may push the page sideways. */}
      <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden">
        {merged.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No activity in this view</p>
        ) : (
          <div>
            {merged.map((item) => {
              if (item.type === "note") {
                const note = item.data as NoteItem;
                const styles = TONE_STYLES.note;
                return (
                  <Row key={`note-${item.id}`} icon={StickyNote} tone="note" hint={EVENT_STYLE.note_added.hint}>
                    <div className={`rounded-lg border p-2.5 ${styles.card}`}>
                      <p className="text-[11px] text-muted-foreground">
                        {whenLabel(item.date)} · {note.user.name}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{note.noteBody}</p>
                    </div>
                  </Row>
                );
              }

              const event = item.data as TimelineEvent;
              const { icon, tone, hint } = styleFor(event.eventType, event.eventDataJson);
              const styles = TONE_STYLES[tone];
              const detail = formatEventDetail(event);
              const label = eventLabels[event.eventType] ?? event.eventType;
              const who = event.user?.name ?? "System";

              // A logged call or email: the note is the point, and it stays
              // editable so it can be finished later.
              if (event.eventType === "interaction_logged") {
                const data = (event.eventDataJson ?? {}) as {
                  kind?: string;
                  outcomeLabel?: string;
                  note?: string | null;
                  editedAt?: string;
                };
                const mine = !!currentUserId && event.user?.id === currentUserId;
                const canEdit = mine || isAdmin;
                const isEditing = editing === event.id;
                return (
                  <Row key={`evt-${item.id}`} icon={icon} tone={tone} hint={hint}>
                    <div className={`rounded-lg border p-2.5 ${styles.card}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <p className="text-sm font-medium">
                          {data.kind === "email" ? "Email logged" : "Call logged"}
                          {data.outcomeLabel ? <span className="font-normal text-muted-foreground"> · {data.outcomeLabel}</span> : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {whenLabel(item.date)} · {who}
                        </p>
                      </div>

                      {isEditing ? (
                        <div className="mt-2">
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={3}
                            autoFocus
                            placeholder="What was said, what they need, anything to remember."
                            className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <div className="mt-1.5 flex gap-2">
                            <button
                              onClick={() => saveInteractionNote(event.id)}
                              disabled={isPending}
                              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {isPending ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              disabled={isPending}
                              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {data.note ? (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{data.note}</p>
                          ) : (
                            <p className="mt-1 text-sm italic text-muted-foreground">No notes yet.</p>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => { setEditing(event.id); setDraft(data.note ?? ""); }}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Pencil className="h-3 w-3" />
                              {data.note ? "Edit notes" : "Add notes"}
                            </button>
                          )}
                          {data.editedAt && (
                            <span className="ml-2 text-[11px] text-muted-foreground">edited</span>
                          )}
                        </>
                      )}
                    </div>
                  </Row>
                );
              }

              const highlighted = tone !== "quiet";
              return (
                <Row key={`evt-${item.id}`} icon={icon} tone={tone} hint={hint}>
                  <div className={highlighted ? `rounded-lg border p-2.5 ${styles.card}` : ""}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className={`text-sm ${highlighted ? "font-medium" : ""}`}>{label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {whenLabel(item.date)} · {who}
                      </p>
                    </div>
                    {event.eventType === "lead_data_received" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {open[item.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {open[item.id] ? "Hide submission" : "Show submission"}
                        </button>
                        {open[item.id] && (
                          <div className="mt-1 max-w-full overflow-x-auto">
                            <SubmissionDataTable
                              data={event.eventDataJson as { fields: Record<string, unknown>; metadata: Record<string, unknown> }}
                              stateClassMap={stateClassMap}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      detail && <p className="mt-0.5 break-words text-sm text-muted-foreground">{detail}</p>
                    )}
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
