"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Inbox, AlertTriangle, UserPlus, Clock, Bell as BellIcon, Users } from "lucide-react";
import { markRead, markAllRead, markClicked } from "@/actions/notification.actions";
import { useTransition } from "react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  read: boolean;
  clicked: boolean;
  leadId: string | null;
  leadName: string | null;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, typeof Inbox> = {
  new_lead: Inbox,
  lead_assigned: UserPlus,
  lead_reassigned: Users,
  sla_warning: Clock,
  sla_breach: AlertTriangle,
  sla_escalation: AlertTriangle,
  follow_up_due: Clock,
  duplicate_detected: AlertTriangle,
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "border-l-4 border-l-destructive",
  HIGH: "border-l-4 border-l-warning",
  NORMAL: "",
  LOW: "",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface NotificationPanelProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function NotificationPanel({ notifications, unreadCount, onClose, onRefresh }: NotificationPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(notif: NotificationItem) {
    startTransition(async () => {
      if (!notif.read) await markRead(notif.id);
      if (!notif.clicked) await markClicked(notif.id);
      onRefresh();
    });
    if (notif.leadId) {
      router.push(`/leads/${notif.leadId}`);
      onClose();
    }
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllRead();
      onRefresh();
    });
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border bg-card shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
            <BellIcon className="h-8 w-8 mb-2 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = NOTIFICATION_ICONS[notif.type] ?? BellIcon;
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0 ${
                  !notif.read ? "bg-primary/5" : ""
                } ${PRIORITY_STYLES[notif.priority] ?? ""}`}
              >
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Icon className={`h-4 w-4 ${!notif.read ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${!notif.read ? "font-semibold" : ""}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
