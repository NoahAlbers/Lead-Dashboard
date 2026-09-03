"use client";

import { Fragment, useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  getLiveFormSessions,
  getRecentSessions,
  getRecentCompletions,
  getAbandonedSessions,
  getConnectionHealth,
  getClientReportedFailures,
  getAuthSuspectSubmissions,
  processAuthSuspectItem,
  promotePartialToLead,
} from "@/actions/monitor.actions";
import { TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import { toast } from "@/components/ui/use-toast";

type LiveSessions = Awaited<ReturnType<typeof getLiveFormSessions>>;
type LiveSession = LiveSessions["live"][number];
type RecentSession = Awaited<ReturnType<typeof getRecentSessions>>[number];
type RecentCompletion = Awaited<ReturnType<typeof getRecentCompletions>>[number];
type AbandonedSession = Awaited<
  ReturnType<typeof getAbandonedSessions>
>[number];
type HealthData = Awaited<ReturnType<typeof getConnectionHealth>>;
type ClientFailure = Awaited<ReturnType<typeof getClientReportedFailures>>[number];
type AuthSuspect = Awaited<ReturnType<typeof getAuthSuspectSubmissions>>[number];

function timeAgo(isoString: string | null): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function leftAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "left just now";
  if (mins < 60) return `left ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `left ${hours}h ago`;
  return `left ${Math.floor(hours / 24)}d ago`;
}

function HealthCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "green" | "yellow" | "red" | "default";
}) {
  const borderColors = {
    green: "border-green-500/40 bg-green-50 dark:bg-green-950/20",
    yellow: "border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/20",
    red: "border-red-500/40 bg-red-50 dark:bg-red-950/20",
    default: "border-border bg-card",
  };
  return (
    <div
      className={`rounded-lg border p-4 ${borderColors[color]}`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

/** One person on the form right now: where they are, who they are, and how to reach them. */
/** Everything a visitor has typed so far, two columns, contact details first. */
function AnswersPanel({ answers, answersAt }: { answers: LiveSession["answers"]; answersAt: string | null }) {
  if (answers.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing filled in yet.</p>;
  }
  return (
    <div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        {answers.map((a) => (
          <div key={a.key} className="flex gap-2 border-b border-dashed border-border/60 pb-1 last:border-0">
            <dt className="w-32 shrink-0 text-muted-foreground">{a.label}</dt>
            <dd className={`min-w-0 flex-1 break-words ${a.isContact ? "font-medium" : ""}`}>{a.value}</dd>
          </div>
        ))}
      </dl>
      {answersAt && (
        <p className="mt-2 text-[11px] text-muted-foreground">Updated {timeAgo(answersAt)}</p>
      )}
    </div>
  );
}

function ReturnBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span
      className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
      title="They left the form and came back; this is all one visit"
    >
      Came back {count === 1 ? "once" : `${count} times`}
    </span>
  );
}

function LiveSessionCard({ s }: { s: LiveSession }) {
  const stale = s.secondsSinceSeen > 45;
  const [showAnswers, setShowAnswers] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${stale ? "bg-yellow-500" : "bg-green-500 animate-pulse"}`} />
            <p className="font-semibold">
              {s.name ?? <span className="text-muted-foreground">Anonymous visitor</span>}
            </p>
            {s.company && <span className="truncate text-sm text-muted-foreground">{s.company}</span>}
            <ReturnBadge count={s.returnCount} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            On the form {s.minutesOnForm} min · seen {s.secondsSinceSeen < 10 ? "just now" : `${s.secondsSinceSeen}s ago`}
            {s.localTime && ` · their time ${s.localTime}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.phone && (
            <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`} className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700">
              Call {s.phone}
            </a>
          )}
          {s.email && (
            <a href={`mailto:${s.email}`} className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
              Email
            </a>
          )}
          {s.leadId && (
            <Link href={`/leads/${s.leadId}`} className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
              Open lead
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">{s.stepLabel}</span>
          <span className="text-muted-foreground">{s.progressPct}% through</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(3, s.progressPct)}%` }} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Device</dt>
          <dd>{s.device} · {s.browser}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{s.location ?? "Unknown"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Timezone</dt>
          <dd className="truncate" title={s.timezone ?? undefined}>{s.timezone ?? "Unknown"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">IP</dt>
          <dd className="font-mono">{s.ip ?? "Unknown"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Source</dt>
          <dd className="truncate" title={s.source ?? undefined}>{s.utm ?? s.source ?? "Direct"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Session</dt>
          <dd className="font-mono">{s.shortId}</dd>
        </div>
      </dl>

      {s.variants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {s.variants.map((v) => (
            <span key={v.key} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700" title={v.key}>
              {v.value}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 border-t pt-2">
        <button
          type="button"
          onClick={() => setShowAnswers((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {showAnswers ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {showAnswers ? "Hide what they've typed" : `Show what they've typed${s.answers.length > 0 ? ` (${s.answers.length})` : ""}`}
        </button>
        {showAnswers && (
          <div className="mt-2">
            <AnswersPanel answers={s.answers} answersAt={s.answersAt} />
          </div>
        )}
      </div>

      {!s.phone && !s.email && (
        <p className="mt-2 text-[11px] text-muted-foreground">No contact details yet; they reach the contact step shortly.</p>
      )}
    </div>
  );
}

export function LiveMonitor() {
  const [liveSessions, setLiveSessions] = useState<LiveSessions>({ live: [], justLeft: [] });
  // Which of the "left recently" rows have their answers open.
  const [openLeft, setOpenLeft] = useState<Record<string, boolean>>({});
  const toggleLeftRow = useCallback((id: string) => {
    setOpenLeft((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [completions, setCompletions] = useState<RecentCompletion[]>([]);
  const [abandoned, setAbandoned] = useState<AbandonedSession[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [clientFailures, setClientFailures] = useState<ClientFailure[]>([]);
  const [authSuspects, setAuthSuspects] = useState<AuthSuspect[]>([]);
  const [isPending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(() => {
    startTransition(async () => {
      try {
        const [sessions, recent, comps, aband, hlth, failures, suspects] = await Promise.all([
          getLiveFormSessions(),
          getRecentSessions(),
          getRecentCompletions(),
          getAbandonedSessions(),
          getConnectionHealth(),
          getClientReportedFailures(),
          getAuthSuspectSubmissions(),
        ]);
        setLiveSessions(sessions);
        setRecentSessions(recent);
        setCompletions(comps);
        setAbandoned(aband);
        setHealth(hlth);
        setClientFailures(failures);
        setAuthSuspects(suspects);
        setLastRefresh(new Date());
      } catch (err) {
        console.error("Monitor refresh failed:", err);
      }
    });
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      setLiveSessions(await getLiveFormSessions());
    } catch (err) {
      console.error("Live session refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Anyone on the form right now is the one thing worth watching closely: the
  // form pings every fifteen seconds, so poll a little faster than that.
  useEffect(() => {
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  const handlePromote = async (queueId: string) => {
    setPromotingId(queueId);
    try {
      const res = await promotePartialToLead(queueId);
      if (!res.success) {
        toast({ title: "No lead created", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Lead created",
        description: "Everything the visitor entered has been carried over.",
      });
      fetchAll();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create lead",
        variant: "destructive",
      });
    } finally {
      setPromotingId(null);
    }
  };

  const handleProcessSuspect = async (queueId: string) => {
    setProcessingId(queueId);
    try {
      await processAuthSuspectItem(queueId);
      toast({
        title: "Processing Started",
        description: "Auth-suspect submission is now being processed.",
      });
      fetchAll();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to process",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const hasAlerts =
    health &&
    (health.failedCount > 0 ||
      health.clientFailureCount > 0 ||
      health.authSuspectCount > 0);

  return (
    <div className="space-y-6">
      {/* Failure Alert Banner */}
      {hasAlerts && (
        <div className="rounded-lg border border-red-500/60 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-xl mt-0.5">!</span>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">
                Ingestion Alerts (Last 24h)
              </p>
              <div className="mt-1 text-sm text-red-700 dark:text-red-400 space-y-0.5">
                {health!.failedCount > 0 && (
                  <p>{health!.failedCount} failed pipeline processing(s)</p>
                )}
                {health!.clientFailureCount > 0 && (
                  <p>
                    {health!.clientFailureCount} client-reported total failure(s)
                    — leads may have been LOST
                  </p>
                )}
                {health!.authSuspectCount > 0 && (
                  <p>
                    {health!.authSuspectCount} submission(s) with invalid auth
                    key — awaiting manual review
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Health Panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Connection Health</h2>
          <span className="text-xs text-muted-foreground">
            {isPending ? "Refreshing..." : `Updated ${timeAgo(lastRefresh.toISOString())}`}
          </span>
        </div>
        {health ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <HealthCard
              label="Queue Depth"
              value={health.queueDepth}
              color={
                health.queueDepth === 0
                  ? "green"
                  : health.queueDepth <= 5
                    ? "yellow"
                    : "red"
              }
            />
            <HealthCard
              label="Last Submission"
              value={timeAgo(health.lastSubmission)}
              color="default"
            />
            <HealthCard
              label="Failed (24h)"
              value={health.failedCount}
              color={health.failedCount === 0 ? "green" : "red"}
            />
            <HealthCard
              label="Processed (24h)"
              value={health.processingRate}
              color="default"
            />
            <HealthCard
              label="Total Submissions (24h)"
              value={health.totalRecent}
              color="default"
            />
            <HealthCard
              label="Auth Suspect (24h)"
              value={health.authSuspectCount}
              color={health.authSuspectCount === 0 ? "green" : "yellow"}
            />
            <HealthCard
              label="Client Failures (24h)"
              value={health.clientFailureCount}
              color={health.clientFailureCount === 0 ? "green" : "red"}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4 animate-pulse h-20"
              />
            ))}
          </div>
        )}
      </div>

      {/* Client-Reported Failures */}
      {clientFailures.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-red-700 dark:text-red-400">
            Client-Reported Failures (24h)
          </h2>
          <div className="rounded-lg border border-red-300 dark:border-red-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-red-50 dark:bg-red-950/30">
                  <th className="text-left p-3 font-medium">Submission ID</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Error</th>
                  <th className="text-left p-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {clientFailures.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{f.submissionId.slice(0, 12)}...</td>
                    <td className="p-3">{f.name}</td>
                    <td className="p-3">{f.email}</td>
                    <td className="p-3">{f.phone}</td>
                    <td className="p-3 text-xs text-red-600 max-w-[200px] truncate">
                      {f.errorMessage}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {timeAgo(f.receivedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auth-Suspect Submissions */}
      {authSuspects.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-yellow-700 dark:text-yellow-400">
            Auth-Suspect Submissions (24h)
          </h2>
          <div className="rounded-lg border border-yellow-300 dark:border-yellow-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-yellow-50 dark:bg-yellow-950/30">
                  <th className="text-left p-3 font-medium">Submission ID</th>
                  <th className="text-left p-3 font-medium">Receipt ID</th>
                  <th className="text-left p-3 font-medium">IP</th>
                  <th className="text-left p-3 font-medium">When</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {authSuspects.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{s.submissionId.slice(0, 12)}...</td>
                    <td className="p-3 font-mono text-xs">{s.receiptId ?? "—"}</td>
                    <td className="p-3 text-xs">{s.sourceIp}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {timeAgo(s.receivedAt.toISOString())}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleProcessSuspect(s.id)}
                        disabled={processingId === s.id}
                        className="inline-flex items-center rounded-md bg-yellow-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                      >
                        {processingId === s.id ? "Processing..." : "Process Anyway"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Form Sessions */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">On the form right now</h2>
          <p className="text-xs text-muted-foreground">
            {liveSessions.live.length > 0
              ? `${liveSessions.live.length} live · refreshes every 5 seconds`
              : "Refreshes every 5 seconds"}
          </p>
        </div>

        {liveSessions.live.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nobody is filling out the form at the moment.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {liveSessions.live.map((s) => (
              <LiveSessionCard key={s.sessionId} s={s} />
            ))}
          </div>
        )}

        {liveSessions.justLeft.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-medium">Left in the last half hour</p>
              <p className="text-xs text-muted-foreground">{liveSessions.justLeft.length} sessions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="w-8 p-2.5" />
                    <th className="p-2.5 text-left font-medium">Who</th>
                    <th className="p-2.5 text-left font-medium">Reached</th>
                    <th className="p-2.5 text-left font-medium">Device</th>
                    <th className="p-2.5 text-left font-medium">Where</th>
                    <th className="p-2.5 text-left font-medium">Last seen</th>
                    <th className="p-2.5 text-left font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {liveSessions.justLeft.map((s) => (
                    <Fragment key={s.sessionId}>
                    <tr
                      className={`border-b last:border-0 ${s.answers.length > 0 ? "cursor-pointer hover:bg-muted/40" : ""}`}
                      onClick={s.answers.length > 0 ? () => toggleLeftRow(s.sessionId) : undefined}
                    >
                      <td className="p-2.5 align-top text-muted-foreground">
                        {s.answers.length > 0 &&
                          (openLeft[s.sessionId] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{s.name ?? <span className="text-muted-foreground">Anonymous</span>}</span>
                          <ReturnBadge count={s.returnCount} />
                        </div>
                        {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                      </td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{s.stepLabel}</span>
                      </td>
                      <td className="p-2.5 text-xs text-muted-foreground">{s.device} · {s.browser}</td>
                      <td className="p-2.5 text-xs text-muted-foreground">{s.location ?? "Unknown"}</td>
                      <td className="p-2.5 text-xs text-muted-foreground">{leftAgo(s.lastSeenAt)}</td>
                      <td className="p-2.5 text-xs">
                        {s.leadId ? (
                          <Link href={`/leads/${s.leadId}`} className="text-blue-600 hover:underline">Became a lead</Link>
                        ) : s.outcome === "completed" ? (
                          <span className="text-emerald-600">Submitted</span>
                        ) : (
                          <span className="text-muted-foreground">Did not finish</span>
                        )}
                      </td>
                    </tr>
                    {openLeft[s.sessionId] && (
                      <tr className="border-b bg-muted/30 last:border-0">
                        <td />
                        <td colSpan={5} className="p-3">
                          <AnswersPanel answers={s.answers} answersAt={s.answersAt} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recently Completed */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recently Completed</h2>
        {completions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No recent completions
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Receipt ID</th>
                  <th className="text-left p-3 font-medium">Name / Company</th>
                  <th className="text-left p-3 font-medium">Score</th>
                  <th className="text-left p-3 font-medium">Tier</th>
                  <th className="text-left p-3 font-medium">Submitted</th>
                  <th className="text-left p-3 font-medium">Processing Time</th>
                  <th className="text-left p-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {completions.map((c) => {
                  const processingMs =
                    c.processedAt && c.receivedAt
                      ? new Date(c.processedAt).getTime() -
                        new Date(c.receivedAt).getTime()
                      : null;
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">
                        {c.receiptId ?? "\u2014"}
                      </td>
                      <td className="p-3">
                        <div>{c.lead?.fullName ?? "\u2014"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.lead?.companyName ?? ""}
                        </div>
                      </td>
                      <td className="p-3">
                        <ScoreBadge score={c.lead?.score ?? null} />
                      </td>
                      <td className="p-3">
                        <TierBadge tier={c.lead?.qualityTier ?? null} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {timeAgo(c.receivedAt.toISOString())}
                      </td>
                      <td className="p-3 text-xs">
                        {processingMs !== null
                          ? processingMs < 1000
                            ? `${processingMs}ms`
                            : `${(processingMs / 1000).toFixed(1)}s`
                          : "\u2014"}
                      </td>
                      <td className="p-3">
                        {c.lead?.id ? (
                          <Link
                            href={`/leads/${c.lead.id}`}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            View Lead
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            \u2014
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Abandoned Sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Abandoned Sessions (24h)
        </h2>
        {abandoned.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No abandoned sessions
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Session</th>
                  <th className="text-left p-3 font-medium">Name / Email</th>
                  <th className="text-left p-3 font-medium">Last Step</th>
                  <th className="text-left p-3 font-medium">Time on Form</th>
                  <th className="text-left p-3 font-medium">When</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {abandoned.map((a) => {
                  const raw = a.rawPayload as Record<string, unknown>;
                  const fields = (raw?.fields ?? raw) as Record<
                    string,
                    unknown
                  >;
                  const name = String(
                    fields?.fullName ??
                      fields?.full_name ??
                      fields?.name ??
                      "\u2014"
                  );
                  const email = String(fields?.email ?? "\u2014");
                  const timeOnForm = Math.round(
                    (Date.now() - new Date(a.receivedAt).getTime()) / 60000
                  );

                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">
                        {a.sessionId?.slice(0, 8) ?? "unknown"}
                      </td>
                      <td className="p-3">
                        <div>{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {email}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-medium">
                          {a.partialStep ?? "unknown"}
                        </span>
                      </td>
                      <td className="p-3">{timeOnForm}m</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {timeAgo(a.receivedAt.toISOString())}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handlePromote(a.id)}
                          disabled={promotingId === a.id}
                          className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {promotingId === a.id
                            ? "Creating..."
                            : "Create Lead"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
