"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Pause, Play, Plus, Square, Trash2, RefreshCw } from "lucide-react";
import {
  saveExperiment,
  setExperimentStatus,
  deleteExperiment,
  getExperimentResults,
  type VariantDef,
  type VariantResult,
} from "@/actions/experiment.actions";
import { toast } from "@/components/ui/use-toast";

interface Experiment {
  id: string;
  key: string;
  name: string;
  hypothesis: string | null;
  status: string;
  primaryGoal: "completed" | "contact_reached" | "hot_lead";
  variants: VariantDef[];
  startedAt: string | null;
  endedAt: string | null;
}

const GOALS: Array<{ key: Experiment["primaryGoal"]; label: string }> = [
  { key: "completed", label: "Completed the form" },
  { key: "contact_reached", label: "Gave contact info" },
  { key: "hot_lead", label: "Became a hot lead" },
];

const KNOWN_FLAGS: Array<{ key: string; label: string }> = [
  { key: "skipPitchScreens", label: "Skip the sales pitch screens" },
];

const inputCls = "h-9 rounded-md border border-input bg-card px-3 text-sm";

const STATUS_STYLE: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  ended: "bg-muted text-muted-foreground",
  draft: "bg-blue-50 text-blue-700",
};

function blankExperiment(): Experiment {
  return {
    id: "",
    key: "",
    name: "",
    hypothesis: "",
    status: "draft",
    primaryGoal: "completed",
    variants: [
      { key: "control", weight: 50, description: "Form as it is today", flags: {} },
      { key: "b", weight: 50, description: "", flags: {} },
    ],
    startedAt: null,
    endedAt: null,
  };
}

export function ExperimentsManager({ initial }: { initial: Experiment[] }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Experiment | null>(null);
  const [results, setResults] = useState<Record<string, { variants: VariantResult[]; since: string | null }>>({});

  function save() {
    if (!editing) return;
    startTransition(async () => {
      try {
        await saveExperiment(editing.id || null, {
          key: editing.key,
          name: editing.name,
          hypothesis: editing.hypothesis ?? "",
          primaryGoal: editing.primaryGoal,
          variants: editing.variants,
        });
        toast({ title: "Experiment saved", variant: "success" });
        setEditing(null);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Could not save", variant: "destructive" });
      }
    });
  }

  function loadResults(id: string) {
    startTransition(async () => {
      const r = await getExperimentResults(id);
      setResults((prev) => ({ ...prev, [id]: r }));
    });
  }

  function setVariant(i: number, patch: Partial<VariantDef>) {
    if (!editing) return;
    setEditing({ ...editing, variants: editing.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  }

  return (
    <div className="space-y-4">
      {initial.length === 0 && !editing && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No experiments yet. A good first one: the sales pitch screens on vs. off.
        </div>
      )}

      {initial.map((exp) => {
        const r = results[exp.id];
        return (
          <div key={exp.id} className="rounded-lg border bg-card p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">{exp.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[exp.status] ?? ""}`}>{exp.status}</span>
                  <code className="text-[11px] text-muted-foreground">{exp.key}</code>
                </div>
                {exp.hypothesis && <p className="mt-1 text-sm text-muted-foreground">{exp.hypothesis}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Goal: {GOALS.find((g) => g.key === exp.primaryGoal)?.label} · Variants: {exp.variants.map((v) => `${v.key} ${v.weight}%`).join(", ")}
                  {exp.startedAt && ` · started ${new Date(exp.startedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exp.status !== "running" && exp.status !== "ended" && (
                  <button onClick={() => startTransition(() => setExperimentStatus(exp.id, "running"))} disabled={isPending} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                    <Play className="h-3.5 w-3.5" /> Start
                  </button>
                )}
                {exp.status === "running" && (
                  <button onClick={() => startTransition(() => setExperimentStatus(exp.id, "paused"))} disabled={isPending} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                )}
                {exp.status !== "ended" && exp.status !== "draft" && (
                  <button onClick={() => startTransition(() => setExperimentStatus(exp.id, "ended"))} disabled={isPending} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted" title="Everyone goes back to control">
                    <Square className="h-3.5 w-3.5" /> End
                  </button>
                )}
                <button onClick={() => setEditing(exp)} disabled={isPending} className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Edit</button>
                <button onClick={() => loadResults(exp.id)} disabled={isPending} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                  <RefreshCw className="h-3.5 w-3.5" /> {r ? "Refresh results" : "Results"}
                </button>
                {exp.status === "draft" && (
                  <button onClick={() => { if (confirm("Delete this experiment?")) startTransition(() => deleteExperiment(exp.id)); }} disabled={isPending} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {r && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Variant</th>
                      <th className="px-2 py-1.5 text-right font-medium">Sessions</th>
                      <th className="px-2 py-1.5 text-right font-medium">Contact info</th>
                      <th className="px-2 py-1.5 text-right font-medium">Completed</th>
                      <th className="px-2 py-1.5 text-right font-medium">Hot leads</th>
                      <th className="px-2 py-1.5 text-right font-medium">Contacted</th>
                      <th className="px-2 py-1.5 text-right font-medium">Won</th>
                      <th className="px-2 py-1.5 text-right font-medium">Goal rate</th>
                      <th className="px-2 py-1.5 text-right font-medium">vs control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.variants.map((v, i) => (
                      <tr key={v.key} className="border-t">
                        <td className="px-2 py-1.5 font-medium">{v.key}{i === 0 && <span className="ml-1 text-[10px] text-muted-foreground">(control)</span>}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.sessions}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.reachedContact}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.completed}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.hotLeads}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.contacted}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.won}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(v.goalRate * 100)}%</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {i === 0 ? "" : v.upliftPct == null ? "n/a" : (
                            <span className={v.upliftPct > 0 ? "text-emerald-600" : v.upliftPct < 0 ? "text-red-600" : ""}>
                              {v.upliftPct > 0 ? "+" : ""}{v.upliftPct}%{v.confidence != null ? ` (${v.confidence}% conf.)` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  {r.variants.every((v) => v.sessions < 100) ? "Under 100 sessions per variant; treat any difference as noise for now." : "Confidence is a two-proportion z-test on the primary goal; 95% or more is a real difference."}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {editing ? (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="font-semibold">{editing.id ? "Edit experiment" : "New experiment"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm space-y-1 block">
              <span className="text-xs text-muted-foreground">Name</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${inputCls} w-full`} placeholder="Pitch screens on vs off" />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-xs text-muted-foreground">Key (stable id the form uses)</span>
              <input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} className={`${inputCls} w-full`} placeholder="pitch_screens" disabled={!!editing.id} />
            </label>
            <label className="text-sm space-y-1 block sm:col-span-2">
              <span className="text-xs text-muted-foreground">What you expect to happen</span>
              <input value={editing.hypothesis ?? ""} onChange={(e) => setEditing({ ...editing, hypothesis: e.target.value })} className={`${inputCls} w-full`} placeholder="Removing the pitch screens will raise completion without lowering lead quality" />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-xs text-muted-foreground">Primary goal</span>
              <select value={editing.primaryGoal} onChange={(e) => setEditing({ ...editing, primaryGoal: e.target.value as Experiment["primaryGoal"] })} className={`${inputCls} w-full`}>
                {GOALS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Variants <span className="text-xs font-normal text-muted-foreground">(first one is the control)</span></p>
            {editing.variants.map((v, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[120px_80px_1fr_auto]">
                <input value={v.key} onChange={(e) => setVariant(i, { key: e.target.value })} className={inputCls} placeholder="key" />
                <input type="number" min={0} value={v.weight} onChange={(e) => setVariant(i, { weight: Number(e.target.value) })} className={inputCls} title="Weight (share of visitors)" />
                <input value={v.description ?? ""} onChange={(e) => setVariant(i, { description: e.target.value })} className={inputCls} placeholder="What's different" />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {KNOWN_FLAGS.map((f) => (
                    <label key={f.key} className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!v.flags?.[f.key]} onChange={(e) => setVariant(i, { flags: { ...(v.flags ?? {}), [f.key]: e.target.checked } })} className="h-3.5 w-3.5" />
                      {f.label}
                    </label>
                  ))}
                  {editing.variants.length > 2 && i > 0 && (
                    <button onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-red-600" title="Remove variant">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => setEditing({ ...editing, variants: [...editing.variants, { key: `v${editing.variants.length + 1}`, weight: 0, description: "", flags: {} }] })} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
              <Plus className="h-3.5 w-3.5" /> Add variant
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isPending ? "Saving..." : "Save experiment"}</button>
            <button onClick={() => setEditing(null)} disabled={isPending} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(blankExperiment())} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground hover:bg-muted/40">
          <Plus className="h-4 w-4" /> New experiment
        </button>
      )}
    </div>
  );
}
