import { format, toZonedTime } from "date-fns-tz";

interface TimelineEvent {
  id: string;
  createdAt: Date;
  eventType: string;
  eventDataJson: unknown;
  user: { id: string; name: string } | null;
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
  return null;
}

const EST_TZ = "America/New_York";

function formatEST(date: Date): string {
  const zoned = toZonedTime(date, EST_TZ);
  return format(zoned, "MMM d, yyyy h:mm a", { timeZone: EST_TZ }) + " EST";
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No activity yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const detail = formatEventDetail(event);
        return (
          <div key={event.id} className="flex gap-3 text-sm">
            <div className="flex flex-col items-center">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5" />
              <div className="w-px flex-1 bg-border" />
            </div>
            <div className="pb-3">
              <p className="text-xs text-muted-foreground">
                {formatEST(new Date(event.createdAt))}
                {event.user && (
                  <span className="ml-1">— {event.user.name}</span>
                )}
                {!event.user && (
                  <span className="ml-1">— System</span>
                )}
              </p>
              <p className="font-medium mt-0.5">
                {eventLabels[event.eventType] ?? event.eventType}
              </p>
              {detail && (
                <p className="text-muted-foreground mt-0.5">{detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
