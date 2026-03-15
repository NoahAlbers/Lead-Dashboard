import Link from "next/link";
import { EmptyState } from "./dashboard-widget";

const EVENT_LABELS: Record<string, string> = {
  lead_created: "created lead",
  score_calculated: "scored",
  status_changed: "updated status on",
  note_added: "added note to",
  email_action_opened: "emailed",
  call_action_opened: "called",
  referral_action_opened: "referred",
  crm_exported: "exported",
  duplicate_flagged: "flagged duplicate",
  assigned_user_changed: "reassigned",
  quick_log: "logged action on",
};

interface Activity {
  id: string;
  leadId: string;
  leadName: string;
  actor: string;
  eventType: string;
  createdAt: string;
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return <EmptyState message="No recent activity" />;

  return (
    <div className="space-y-2 max-h-[280px] overflow-auto">
      {activities.map((a) => {
        const ago = timeAgo(new Date(a.createdAt));
        const action = EVENT_LABELS[a.eventType] ?? a.eventType;
        return (
          <div key={a.id} className="flex items-start gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p>
                <span className="font-medium">{a.actor}</span>{" "}
                {action}{" "}
                <Link href={`/leads/${a.leadId}`} className="text-primary hover:underline">
                  {a.leadName}
                </Link>
              </p>
              <p className="text-muted-foreground">{ago}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
