"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { createFollowUpReminder, completeFollowUpReminder, cancelFollowUpReminder } from "@/actions/follow-up.actions";
import { toast } from "@/components/ui/use-toast";

interface Reminder {
  id: string;
  reminderAt: string;
  note: string | null;
  completed: boolean;
  notifiedAt: string | null;
  user: { id: string; name: string };
}

const EST = "America/New_York";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: EST, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Quick picks produce a local datetime-input value (Eastern wall clock). */
function quickPick(kind: "tomorrow" | "3days" | "nextweek"): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: EST }));
  const d = new Date(now);
  if (kind === "tomorrow") d.setDate(d.getDate() + 1);
  if (kind === "3days") d.setDate(d.getDate() + 3);
  if (kind === "nextweek") d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Interpret a datetime-local string as Eastern time and return an ISO instant. */
function easternToIso(local: string): string {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Find the UTC instant whose Eastern wall clock equals the requested time.
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetMin = (() => {
    const asEst = new Date(new Date(guess).toLocaleString("en-US", { timeZone: EST }));
    return (guess - asEst.getTime()) / 60000;
  })();
  return new Date(guess + offsetMin * 60000).toISOString();
}

export function FollowUpScheduler({ leadId, reminders }: { leadId: string; reminders: Reminder[] }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(quickPick("tomorrow"));
  const [note, setNote] = useState("");

  const pending = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed).slice(0, 3);

  function schedule() {
    if (!when) return;
    startTransition(async () => {
      try {
        await createFollowUpReminder(leadId, easternToIso(when), note.trim() || undefined);
        toast({ title: `Follow-up set for ${fmt(easternToIso(when))} EST`, variant: "success" });
        setOpen(false);
        setNote("");
      } catch {
        toast({ title: "Couldn't schedule the follow-up", variant: "destructive" });
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Follow-up</h3>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
          {open ? "Close" : "Schedule"}
        </button>
      </div>

      {open && (
        <div className="mb-3 space-y-2 rounded-md border bg-muted/40 p-2">
          <div className="flex flex-wrap gap-1">
            {([["tomorrow", "Tomorrow 9am"], ["3days", "In 3 days"], ["nextweek", "Next Monday"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setWhen(quickPick(k))} className="rounded-full border bg-card px-2 py-0.5 text-[11px] hover:bg-muted">
                {label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What to do (optional)"
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">Times are Eastern. You'll get a notification when it's due.</p>
          <button
            onClick={schedule}
            disabled={isPending || !when}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Set follow-up"}
          </button>
        </div>
      )}

      {pending.length === 0 && !open ? (
        <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
      ) : (
        <ul className="space-y-1.5">
          {pending.map((r) => {
            const overdue = new Date(r.reminderAt).getTime() < Date.now();
            return (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${overdue ? "bg-red-500" : "bg-amber-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${overdue ? "text-red-600" : ""}`}>{fmt(r.reminderAt)} EST{overdue ? " · overdue" : ""}</p>
                  {r.note && <p className="text-muted-foreground">{r.note}</p>}
                  <p className="text-[10px] text-muted-foreground">for {r.user.name}</p>
                </div>
                <button
                  title="Mark done"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await completeFollowUpReminder(r.id); toast({ title: "Follow-up completed", variant: "success" }); })}
                  className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Cancel"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await cancelFollowUpReminder(r.id); })}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Completed: {done.map((r) => fmt(r.reminderAt)).join(", ")}
        </p>
      )}
    </div>
  );
}
