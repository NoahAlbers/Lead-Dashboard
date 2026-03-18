"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Inbox,
  XCircle,
  Activity,
  Loader2,
} from "lucide-react";
import {
  getIngestionStats,
  getFailedSubmissions,
  getIngestionTimeline,
  retryIngestionItem,
  runReconciliationNow,
} from "@/actions/ingestion.actions";
import { toast } from "@/components/ui/use-toast";

type Stats = Awaited<ReturnType<typeof getIngestionStats>>;
type FailedItem = Awaited<ReturnType<typeof getFailedSubmissions>>[number];
type TimelinePoint = { date: string; count: number };

interface IngestionHealthDashboardProps {
  initialStats: Stats;
  isAdmin: boolean;
}

export function IngestionHealthDashboard({
  initialStats,
  isAdmin,
}: IngestionHealthDashboardProps) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReconciling, startReconcile] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [failed, tl] = await Promise.all([
          getFailedSubmissions(),
          getIngestionTimeline(),
        ]);
        setFailedItems(
          failed.map((f) => ({
            ...f,
            receivedAt: new Date(f.receivedAt),
          }))
        );
        setTimeline(tl);
      } catch {
        // Silently handle — stats already loaded from server
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleRefresh() {
    setLoading(true);
    try {
      const [newStats, failed, tl] = await Promise.all([
        getIngestionStats(),
        getFailedSubmissions(),
        getIngestionTimeline(),
      ]);
      setStats(newStats);
      setFailedItems(
        failed.map((f) => ({
          ...f,
          receivedAt: new Date(f.receivedAt),
        }))
      );
      setTimeline(tl);
    } catch {
      toast({ title: "Failed to refresh stats", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      await retryIngestionItem(id);
      toast({ title: "Item reprocessed", variant: "success" });
      // Refresh
      const failed = await getFailedSubmissions();
      setFailedItems(
        failed.map((f) => ({
          ...f,
          receivedAt: new Date(f.receivedAt),
        }))
      );
      const newStats = await getIngestionStats();
      setStats(newStats);
    } catch {
      toast({ title: "Retry failed", variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  }

  function handleRunReconciliation() {
    startReconcile(async () => {
      try {
        const result = await runReconciliationNow();
        toast({
          title: result.discrepancy
            ? "Reconciliation complete (discrepancy found)"
            : "Reconciliation complete - all clear",
          variant: result.discrepancy ? "destructive" : "success",
        });
        // Refresh stats
        const newStats = await getIngestionStats();
        setStats(newStats);
      } catch {
        toast({ title: "Reconciliation failed", variant: "destructive" });
      }
    });
  }

  function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Ingestion Health</h2>
          <p className="text-sm text-muted-foreground">
            Lead submission pipeline monitoring
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <StatCard
          icon={<Inbox className="h-4 w-4 text-blue-500" />}
          label="Queue Depth"
          value={stats.queueDepth}
          alert={stats.queueDepth > 10}
        />
        <StatCard
          icon={<Activity className="h-4 w-4 text-indigo-500" />}
          label="24h Received"
          value={stats.last24h.received}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          label="24h Completed"
          value={stats.last24h.completed}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          label="24h Failed"
          value={stats.last24h.failed}
          alert={stats.last24h.failed > 0}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Success Rate"
          value={`${stats.successRate}%`}
          alert={stats.successRate < 90}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label="Avg Processing"
          value={formatMs(stats.avgProcessingTimeMs)}
        />
      </div>

      {/* Partials + Duplicates summary */}
      {(stats.last24h.partial > 0 || stats.last24h.duplicates > 0) && (
        <div className="flex gap-4 mb-5 text-sm text-muted-foreground">
          {stats.last24h.partial > 0 && (
            <span>
              Partial submissions (24h):{" "}
              <span className="font-medium text-foreground">
                {stats.last24h.partial}
              </span>
            </span>
          )}
          {stats.last24h.duplicates > 0 && (
            <span>
              Duplicates (24h):{" "}
              <span className="font-medium text-foreground">
                {stats.last24h.duplicates}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Timeline Chart */}
      {timeline.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium mb-2">Submissions (Last 7 Days)</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const parts = d.split("-");
                    return `${parts[1]}/${parts[2]}`;
                  }}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(d) => {
                    const date = new Date(String(d) + "T00:00:00");
                    return date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Submissions"
                  fill="hsl(var(--primary))"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Failed Submissions Table */}
      {failedItems.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Failed Submissions ({failedItems.length})
          </h3>
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Submission ID
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Receipt
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Error
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Retries
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Received
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        {item.submissionId.slice(0, 12)}...
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {item.receiptId ?? "-"}
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate text-red-600">
                        {item.errorMessage ?? "Unknown error"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.retryCount}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(item.receivedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={retryingId === item.id}
                          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {retryingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation */}
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Reconciliation</h3>
            {stats.lastReconciliation ? (
              <p className="text-xs text-muted-foreground mt-1">
                Last run: {formatRelativeTime(stats.lastReconciliation.createdAt)}
                {" | "}
                {stats.lastReconciliation.submissionsReceived} submissions,{" "}
                {stats.lastReconciliation.leadsCreated} leads
                {" | "}
                <span
                  className={
                    stats.lastReconciliation.discrepancy
                      ? "text-red-500 font-medium"
                      : "text-green-600 font-medium"
                  }
                >
                  {stats.lastReconciliation.discrepancy
                    ? "Discrepancy detected"
                    : "All clear"}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                No reconciliation runs yet
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={handleRunReconciliation}
              disabled={isReconciling}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isReconciling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Run Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${alert ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "bg-card"}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
