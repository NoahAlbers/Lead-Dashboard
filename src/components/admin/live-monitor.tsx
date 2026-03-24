"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  getActiveSessions,
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

type ActiveSession = Awaited<ReturnType<typeof getActiveSessions>>[number];
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

function StatusDot({ status }: { status: "active" | "idle" | "abandoned" }) {
  const colors = {
    active: "bg-green-500",
    idle: "bg-yellow-500",
    abandoned: "bg-gray-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${colors[status]}`}
      />
      <span className="capitalize text-xs">{status}</span>
    </span>
  );
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

export function LiveMonitor() {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
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
        const [sessions, comps, aband, hlth, failures, suspects] = await Promise.all([
          getActiveSessions(),
          getRecentCompletions(),
          getAbandonedSessions(),
          getConnectionHealth(),
          getClientReportedFailures(),
          getAuthSuspectSubmissions(),
        ]);
        setActiveSessions(sessions);
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

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handlePromote = async (queueId: string) => {
    setPromotingId(queueId);
    try {
      await promotePartialToLead(queueId);
      toast({
        title: "Lead Created",
        description: "Partial session has been promoted to a lead.",
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
        <h2 className="text-lg font-semibold mb-3">Active Form Sessions</h2>
        {activeSessions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No active sessions
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Session</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Company</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Current Step</th>
                  <th className="text-left p-3 font-medium">Time on Form</th>
                  <th className="text-left p-3 font-medium">Started</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{s.sessionId}</td>
                    <td className="p-3">{s.name}</td>
                    <td className="p-3">{s.company}</td>
                    <td className="p-3">{s.email}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        {s.currentStep}
                      </span>
                    </td>
                    <td className="p-3">{s.timeOnForm}m</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {timeAgo(s.startedAt)}
                    </td>
                    <td className="p-3">
                      <StatusDot status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
