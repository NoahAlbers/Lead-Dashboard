"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
  getFormAnalytics,
  type AnalyticsFilters,
  type BreakdownRow,
  type FormAnalytics as AnalyticsData,
} from "@/actions/form-analytics.actions";

const inputCls = "h-9 rounded-md border border-input bg-card px-3 text-sm";

const DAY_OPTIONS = [7, 14, 30, 90];

const numberFormat = new Intl.NumberFormat("en-US");
const num = (n: number) => numberFormat.format(n);
/** Rates arrive as fractions; on screen they get one decimal and a % sign. */
const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

type SortKey = "sessions" | "completionRate" | "contactRate" | "leads";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

function emptyFilters(days: number): AnalyticsFilters {
  return { days };
}

function hasActiveFilters(f: AnalyticsFilters): boolean {
  return !!(f.device || f.browser || f.os || f.country || f.utmSource || f.experimentKey || f.variantKey);
}

/** A plain bordered card, matching the experiments manager. */
function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Uplift({ value }: { value: number }) {
  const tone = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-muted-foreground";
  return (
    <span className={tone}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Step-by-step funnel with a bar per step and an expandable "who left here" line. */
function StepFunnel({ data }: { data: AnalyticsData }) {
  const [open, setOpen] = useState<string | null>(null);
  const steps = data.steps;
  const first = steps[0]?.reached ?? 0;
  const max = Math.max(1, first);

  // Worst third of drop rates is red, middle third amber, the rest neutral.
  const rates = steps.map((s) => s.dropRate).sort((a, b) => a - b);
  const cut = (q: number) => (rates.length ? rates[Math.min(rates.length - 1, Math.floor(rates.length * q))] : 0);
  const amberFrom = cut(1 / 3);
  const redFrom = cut(2 / 3);

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">No steps were reached in this window.</p>;
  }

  return (
    <div className="space-y-1">
      {steps.map((s) => {
        const worst = data.worstSteps.find((w) => w.key === s.key);
        const isOpen = open === s.key;
        const barTone =
          s.dropRate >= redFrom && s.dropRate > 0
            ? "bg-red-500"
            : s.dropRate >= amberFrom && s.dropRate > 0
              ? "bg-amber-500"
              : "bg-primary";
        return (
          <div key={s.key} className="rounded-md border">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : s.key)}
              className="flex w-full flex-col gap-1.5 px-2.5 py-2 text-left text-xs hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="flex w-full shrink-0 items-center gap-1.5 sm:w-48">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate font-medium" title={s.key}>
                  {s.label}
                </span>
                {s.pitch && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">pitch</span>
                )}
              </span>
              <span className="h-2.5 w-full flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${barTone}`}
                  style={{ width: `${Math.max(2, (s.reached / max) * 100)}%` }}
                />
              </span>
              <span className="flex shrink-0 items-center gap-3 tabular-nums sm:justify-end">
                <span className="w-14 text-right" title="Reached this step">
                  {num(s.reached)}
                </span>
                <span
                  className={`w-14 text-right ${s.dropped > 0 ? "text-red-600" : "text-muted-foreground/50"}`}
                  title="Left here"
                >
                  {s.dropped > 0 ? `-${num(s.dropped)}` : "0"}
                </span>
                <span className="w-14 text-right text-muted-foreground" title="Drop rate">
                  {pct(s.dropRate)}
                </span>
                <span className="w-14 text-right text-muted-foreground" title="Median time on step">
                  {s.medianDwellSec != null ? `${num(s.medianDwellSec)}s` : "Unknown"}
                </span>
              </span>
            </button>
            {isOpen && (
              <p className="border-t px-2.5 py-2 text-xs text-muted-foreground">
                {s.dropped === 0
                  ? "Nobody left on this step."
                  : worst && worst.topCombos.length > 0
                    ? `Left here: ${worst.topCombos.map((c) => `${c.combo} (${num(c.count)})`).join(", ")}.`
                    : "No device detail recorded for the people who left here."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Tabbed breakdown tables with sortable columns. */
function Breakdowns({ data }: { data: AnalyticsData }) {
  const [tab, setTab] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: "sessions", dir: "desc" });
  const current = data.breakdowns[Math.min(tab, data.breakdowns.length - 1)];

  const rows = useMemo(() => {
    if (!current) return [] as BreakdownRow[];
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...current.rows].sort((a, b) => (a[sort.key] - b[sort.key]) * factor || a.value.localeCompare(b.value));
  }, [current, sort]);

  if (!current) return null;

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {data.breakdowns.map((b, i) => (
          <button
            key={b.dimension}
            type="button"
            onClick={() => setTab(i)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${i === tab ? "bg-muted" : "hover:bg-muted/50"}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          No sessions carry a value for {current.label.toLowerCase()} in this window.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">{current.label}</th>
                <th className="cursor-pointer px-2 py-1.5 text-right font-medium" onClick={() => toggle("sessions")}>
                  Sessions{arrow("sessions")}
                </th>
                <th className="cursor-pointer px-2 py-1.5 text-right font-medium" onClick={() => toggle("completionRate")}>
                  Completion{arrow("completionRate")}
                </th>
                <th className="cursor-pointer px-2 py-1.5 text-right font-medium" onClick={() => toggle("contactRate")}>
                  Gave contact{arrow("contactRate")}
                </th>
                <th className="cursor-pointer px-2 py-1.5 text-right font-medium" onClick={() => toggle("leads")}>
                  Leads{arrow("leads")}
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Completion rate versus the overall rate, in percentage points">
                  vs average
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.value} className="border-t">
                  <td className="px-2 py-1.5 font-medium">{r.value}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{num(r.sessions)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {pct(r.completionRate)} <span className="text-muted-foreground">({num(r.completed)})</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {pct(r.contactRate)} <span className="text-muted-foreground">({num(r.reachedContact)})</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{num(r.leads)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <Uplift value={r.upliftVsAverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Rows are capped at the twelve biggest values; everything else is folded into Other. The last column is completion
        rate against the overall {pct(data.totals.completionRate)}, in percentage points.
      </p>
    </div>
  );
}

/** Conversion insight: what converts, what does not, and where people leave. */
export function FormAnalytics() {
  const [open, setOpen] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters(30));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback((next: AnalyticsFilters) => {
    startTransition(async () => {
      try {
        const result = await getFormAnalytics(next);
        setData(result);
        setError(null);
      } catch {
        setError("Could not load the conversion numbers. Try again in a moment.");
      }
    });
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  function patch(update: Partial<AnalyticsFilters>) {
    setFilters((f) => ({ ...f, ...update }));
  }

  const options = data?.filterOptions;
  const variantValue = filters.experimentKey ? `${filters.experimentKey}|${filters.variantKey ?? ""}` : "";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <h2 className="text-lg font-semibold">Conversion insight</h2>
        {isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <label className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Window</span>
              <select
                value={filters.days}
                onChange={(e) => patch({ days: Number(e.target.value) })}
                className={inputCls}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    Last {d} days
                  </option>
                ))}
              </select>
            </label>
            <FilterSelect label="Device" value={filters.device ?? ""} options={options?.devices ?? []} onChange={(v) => patch({ device: v || undefined })} />
            <FilterSelect label="Browser" value={filters.browser ?? ""} options={options?.browsers ?? []} onChange={(v) => patch({ browser: v || undefined })} />
            <FilterSelect label="OS" value={filters.os ?? ""} options={options?.oses ?? []} onChange={(v) => patch({ os: v || undefined })} />
            <FilterSelect label="Country" value={filters.country ?? ""} options={options?.countries ?? []} onChange={(v) => patch({ country: v || undefined })} />
            <FilterSelect label="UTM source" value={filters.utmSource ?? ""} options={options?.utmSources ?? []} onChange={(v) => patch({ utmSource: v || undefined })} />
            <label className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Variant</span>
              <select
                value={variantValue}
                onChange={(e) => {
                  const [key, variant] = e.target.value.split("|");
                  patch({ experimentKey: key || undefined, variantKey: variant || undefined });
                }}
                className={inputCls}
              >
                <option value="">All</option>
                {(options?.experiments ?? []).map((exp) => (
                  <optgroup key={exp.key} label={exp.name}>
                    <option value={`${exp.key}|`}>Anyone in {exp.name}</option>
                    {exp.variants.map((v) => (
                      <option key={v} value={`${exp.key}|${v}`}>
                        {v}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {hasActiveFilters(filters) && (
              <button
                type="button"
                onClick={() => setFilters(emptyFilters(filters.days))}
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>

          {error && <p className="rounded-lg border bg-card p-5 text-sm text-red-600">{error}</p>}

          {!data && !error && (
            <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Loading the last {filters.days} days.</p>
          )}

          {data && data.totals.sessions === 0 && (
            <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">No sessions match these filters.</p>
          )}

          {data && data.totals.sessions > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <Kpi label="Sessions" value={num(data.totals.sessions)} />
                <Kpi label="Reached contact" value={num(data.totals.reachedContact)} />
                <Kpi label="Completed" value={num(data.totals.completed)} tone="text-emerald-600" />
                <Kpi label="Completion rate" value={pct(data.totals.completionRate)} tone="text-emerald-600" />
                <Kpi label="Became a lead" value={num(data.totals.becameLead)} />
                <Kpi label="Hot leads" value={num(data.totals.hotLeads)} />
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-3">
                <div>
                  <h3 className="font-semibold">Step funnel</h3>
                  <p className="text-xs text-muted-foreground">
                    Everyone who reached each step, how many left there, and the median time they spent on it. Click a
                    step to see who left. {num(data.totals.abandoned)} sessions were abandoned and {num(data.totals.stillOpen)} are
                    still open.
                  </p>
                </div>
                <StepFunnel data={data} />
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-3">
                <div>
                  <h3 className="font-semibold">Where people fall off</h3>
                  <p className="text-xs text-muted-foreground">The five steps that lose the most people in this window.</p>
                </div>
                {data.worstSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nobody left mid-form in this window.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {data.worstSteps.map((w) => (
                      <li key={w.key}>
                        <span className="font-medium">{num(w.dropped)}</span> {w.dropped === 1 ? "person" : "people"} left on{" "}
                        <span className="font-medium">{w.label}</span>, {pct(w.dropRate)} of everyone who got there
                        {w.topCombos.length > 0 ? `, mostly ${w.topCombos.map((c) => c.combo).join(" and ")}` : ""}.
                      </li>
                    ))}
                  </ul>
                )}
                {data.errors.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Validation errors
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.errors.map((e) => `${e.label}: ${num(e.count)}`).join(" · ")}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-3">
                <div>
                  <h3 className="font-semibold">Breakdowns</h3>
                  <p className="text-xs text-muted-foreground">
                    The same sessions split by who they were and where they came from. Click a column heading to sort.
                  </p>
                </div>
                <Breakdowns data={data} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
