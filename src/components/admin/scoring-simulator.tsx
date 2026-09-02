"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FlaskConical, Search, Play, BarChart3, Loader2, ArrowRight, User, SlidersHorizontal } from "lucide-react";
import {
  searchLeadsForSimulation,
  simulateScoring,
  previewRuleImpact,
  type LeadSearchHit,
  type SimulationResult,
  type ImpactPreview,
  type SimRuleInput,
} from "@/actions/scoring-sim.actions";
import { toast } from "@/components/ui/use-toast";

type Panel = "try" | "impact";
type Source = "existing" | "manual";

const OWNERSHIP_OPTIONS = ["", "Owner", "Property Manager", "Both", "Other"];

const inputCls = "mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

function splitList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function actionLabel(action: string): string {
  switch (action) {
    case "contact": return "Contact";
    case "review_manually": return "Review manually";
    case "refer_or_disqualify": return "Refer or disqualify";
    case "refer": return "Refer out";
    case "disqualify": return "Disqualify";
    default: return action;
  }
}

export function ScoringSimulator({ rules, orderDirty }: { rules: SimRuleInput[]; orderDirty?: boolean }) {
  const [panel, setPanel] = useState<Panel>("try");
  const enabledCount = rules.filter((r) => r.enabled !== false).length;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Test these rules
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Runs the rules exactly as shown above ({enabledCount} enabled{orderDirty ? ", unsaved order" : ""}). Nothing is saved.
          </p>
        </div>
        <div className="flex rounded-md border p-0.5 text-sm">
          <button
            onClick={() => setPanel("try")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 ${panel === "try" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Play className="h-3.5 w-3.5" />
            Try a lead
          </button>
          <button
            onClick={() => setPanel("impact")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 ${panel === "impact" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Preview impact
          </button>
        </div>
      </div>

      {panel === "try" ? <TryLeadPanel rules={rules} /> : <ImpactPanel rules={rules} />}
    </div>
  );
}

function TryLeadPanel({ rules }: { rules: SimRuleInput[] }) {
  const [source, setSource] = useState<Source>("existing");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Existing lead search
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LeadSearchHit | null>(null);
  const searchSeq = useRef(0);

  // Manual fields
  const [units, setUnits] = useState("");
  const [avgRent, setAvgRent] = useState("");
  const [states, setStates] = useState("");
  const [debtTypes, setDebtTypes] = useState("");
  const [rentalTypes, setRentalTypes] = useState("");
  const [ownership, setOwnership] = useState("");
  const [hasCompany, setHasCompany] = useState(true);
  const [hasEmail, setHasEmail] = useState(true);
  const [hasPhone, setHasPhone] = useState(true);

  useEffect(() => {
    if (source !== "existing") return;
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchLeadsForSimulation(q);
        if (seq === searchSeq.current) setHits(found);
      } catch {
        if (seq === searchSeq.current) setHits([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, source]);

  const canRun = source === "existing" ? !!selected : true;

  function run() {
    startTransition(async () => {
      try {
        const target = source === "existing"
          ? { leadId: selected!.id }
          : {
              manual: {
                units: toNumberOrNull(units),
                avgRent: toNumberOrNull(avgRent),
                states: splitList(states),
                debtTypes: splitList(debtTypes),
                rentalTypes: splitList(rentalTypes),
                ownership: ownership || undefined,
                hasCompany,
                hasEmail,
                hasPhone,
              },
            };
        setResult(await simulateScoring(target, rules));
      } catch (err) {
        toast({ title: "Simulation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex rounded-md border p-0.5 text-sm w-fit">
          <button
            onClick={() => setSource("existing")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 ${source === "existing" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <User className="h-3.5 w-3.5" />
            Existing lead
          </button>
          <button
            onClick={() => setSource("manual")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 ${source === "manual" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Manual fields
          </button>
        </div>

        {source === "existing" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Find a lead</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                placeholder="Type a name, company, or email"
                className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm"
              />
              {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {selected ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{selected.companyName || selected.fullName || selected.email}</p>
                <p className="text-xs text-muted-foreground">
                  {[selected.fullName, selected.email].filter(Boolean).join(" · ")}
                  {selected.score !== null ? ` · current score ${selected.score}` : ""}
                  {selected.qualityTier ? ` (${selected.qualityTier})` : ""}
                </p>
              </div>
            ) : hits.length > 0 ? (
              <ul className="rounded-md border divide-y max-h-64 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => { setSelected(h); setHits([]); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <p className="font-medium">{h.companyName || h.fullName || h.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {[h.fullName, h.email].filter(Boolean).join(" · ")}
                        {h.qualityTier ? ` · ${h.qualityTier}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length >= 2 && !searching ? (
              <p className="text-xs text-muted-foreground">No matching leads.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Total units</label>
                <input type="number" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. 250" className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium">Avg rent / unit</label>
                <input type="number" value={avgRent} onChange={(e) => setAvgRent(e.target.value)} placeholder="e.g. 1500" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">States</label>
              <input value={states} onChange={(e) => setStates(e.target.value)} placeholder="TX, FL (comma-separated)" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Debt types</label>
                <input value={debtTypes} onChange={(e) => setDebtTypes(e.target.value)} placeholder="Comma-separated" className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium">Rental types</label>
                <input value={rentalTypes} onChange={(e) => setRentalTypes(e.target.value)} placeholder="Comma-separated" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Ownership</label>
              <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className={inputCls}>
                {OWNERSHIP_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o || "Not specified"}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasCompany} onChange={(e) => setHasCompany(e.target.checked)} className="rounded border-gray-300" />
                Has company
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} className="rounded border-gray-300" />
                Has email
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} className="rounded border-gray-300" />
                Has phone
              </label>
            </div>
          </div>
        )}

        <button
          onClick={run}
          disabled={isPending || !canRun}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run rules
        </button>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm min-h-[200px]">
        {result ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Result for {result.leadLabel}</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-2xl font-bold">{result.score}</p>
                {result.currentScore !== null && result.currentScore !== result.score && (
                  <p className="text-xs text-muted-foreground">currently {result.currentScore}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tier</p>
                <p className="text-lg font-semibold">{result.qualityTier ?? "No tier"}</p>
                {result.currentTier !== null && result.currentTier !== result.qualityTier && (
                  <p className="text-xs text-muted-foreground">currently {result.currentTier}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Action</p>
                <p className="text-lg font-semibold">{actionLabel(result.recommendedAction)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Matched rules ({result.appliedRules.length})</p>
              {result.appliedRules.length === 0 ? (
                <p className="text-muted-foreground">No rules matched. Score stays at the base of 50.</p>
              ) : (
                <ul className="space-y-1">
                  {result.appliedRules.map((r, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 rounded border bg-card px-3 py-1.5">
                      <div>
                        <p className="font-medium">{r.ruleName}</p>
                        <p className="text-xs text-muted-foreground">{r.reason}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.hardStop && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Hard Stop</span>
                        )}
                        <span className={`font-semibold ${r.scoreAdjustment >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {r.scoreAdjustment >= 0 ? "+" : ""}{r.scoreAdjustment}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Pick a lead or fill in a few fields, then run the rules to see the score, tier, and which rules matched.</p>
        )}
      </div>
    </div>
  );
}

function ImpactPanel({ rules }: { rules: SimRuleInput[] }) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ImpactPreview | null>(null);

  function run() {
    startTransition(async () => {
      try {
        setPreview(await previewRuleImpact(rules));
      } catch (err) {
        toast({ title: "Preview failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Re-scores the last 100 non-archived leads with the rules above and compares tiers against what is stored today.
        </p>
        <button
          onClick={run}
          disabled={isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          Preview impact
        </button>
      </div>

      {preview && (
        <div className="space-y-4">
          <div className={`rounded-md border px-3 py-2 text-sm ${preview.changed > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
            {preview.changed === 0
              ? `No leads would change tier (checked ${preview.total}).`
              : `${preview.changed} of ${preview.total} lead${preview.total === 1 ? "" : "s"} would change tier.`}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Tier</th>
                  <th className="py-2 pr-4 font-medium text-right">Before</th>
                  <th className="py-2 pr-4 font-medium text-right">After</th>
                  <th className="py-2 font-medium text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {preview.tiers.map((tier) => {
                  const b = preview.before[tier] ?? 0;
                  const a = preview.after[tier] ?? 0;
                  const d = a - b;
                  return (
                    <tr key={tier} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{tier}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{b}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{a}</td>
                      <td className={`py-2 text-right tabular-nums ${d > 0 ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        {d > 0 ? "+" : ""}{d}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {preview.changes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Leads that would move{preview.changed > preview.changes.length ? ` (showing ${preview.changes.length} of ${preview.changed})` : ""}
              </p>
              <ul className="rounded-md border divide-y">
                {preview.changes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="truncate">{c.label}</span>
                    <span className="flex items-center gap-1.5 shrink-0 text-xs">
                      <span className="text-muted-foreground">{c.beforeTier ?? "No tier"} ({c.beforeScore ?? "n/a"})</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{c.afterTier ?? "No tier"} ({c.afterScore})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
