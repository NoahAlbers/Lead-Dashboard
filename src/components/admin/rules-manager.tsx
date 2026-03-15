"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRule, updateRule, deleteRule, toggleRule } from "@/actions/rule.actions";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface RuleCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface RuleOutcome {
  scoreAdjustment: number;
  reason: string;
  hardStop?: boolean;
  action?: string;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  conditionsJson: unknown;
  outcomesJson: unknown;
  createdAt: string;
  updatedAt: string;
}

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "in", label: "In (list)" },
  { value: "not_in", label: "Not In (list)" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
];

const LEAD_FIELDS = [
  "state", "email", "phone", "companyName", "fullName", "industry",
  "debtType", "serviceRequested", "urgency", "businessType",
  "accountVolume", "city", "zip",
];

export function RulesManager({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [recalculating, setRecalculating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { field: "state", operator: "equals", value: "" },
  ]);
  const [scoreAdj, setScoreAdj] = useState(0);
  const [reason, setReason] = useState("");
  const [hardStop, setHardStop] = useState(false);
  const [action, setAction] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setPriority(0);
    setConditions([{ field: "state", operator: "equals", value: "" }]);
    setScoreAdj(0);
    setReason("");
    setHardStop(false);
    setAction("");
    setEditingRule(null);
    setIsCreating(false);
  }

  function startEdit(rule: Rule) {
    const conds = rule.conditionsJson as RuleCondition[];
    const outcomes = rule.outcomesJson as RuleOutcome;
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description ?? "");
    setPriority(rule.priority);
    setConditions(conds);
    setScoreAdj(outcomes.scoreAdjustment);
    setReason(outcomes.reason);
    setHardStop(outcomes.hardStop ?? false);
    setAction(outcomes.action ?? "");
    setIsCreating(true);
  }

  function showRecalcToast(count: number) {
    toast({
      title: "Scores recalculated",
      description: `Updated scores for ${count} lead${count !== 1 ? "s" : ""}.`,
    });
  }

  function handleSave() {
    const data = {
      name,
      description,
      priority,
      enabled: editingRule?.enabled ?? true,
      conditionsJson: conditions,
      outcomesJson: {
        scoreAdjustment: scoreAdj,
        reason,
        ...(hardStop ? { hardStop: true, action: action || "disqualify" } : {}),
      },
    };

    setRecalculating(true);
    startTransition(async () => {
      let result;
      if (editingRule) {
        result = await updateRule(editingRule.id, data);
      } else {
        result = await createRule(data);
      }
      resetForm();
      setRecalculating(false);
      showRecalcToast(result.recalculatedCount);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this rule?")) return;
    setRecalculating(true);
    startTransition(async () => {
      const result = await deleteRule(id);
      setRules(rules.filter((r) => r.id !== id));
      setRecalculating(false);
      showRecalcToast(result.recalculatedCount);
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    setRecalculating(true);
    startTransition(async () => {
      const result = await toggleRule(id, enabled);
      setRules(rules.map((r) => (r.id === id ? { ...r, enabled } : r)));
      setRecalculating(false);
      showRecalcToast(result.recalculatedCount);
    });
  }

  return (
    <div className="space-y-4">
      {/* Recalculating indicator */}
      {recalculating && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Recalculating all lead scores...
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2">
        {rules.map((rule) => {
          const outcomes = rule.outcomesJson as RuleOutcome;
          return (
            <div
              key={rule.id}
              className={`rounded-lg border bg-card p-4 ${!rule.enabled ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => handleToggle(rule.id, e.target.checked)}
                      disabled={isPending}
                      className="rounded border-gray-300"
                    />
                  </label>
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">
                        {rule.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${outcomes.scoreAdjustment >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {outcomes.scoreAdjustment >= 0 ? "+" : ""}
                    {outcomes.scoreAdjustment}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Priority: {rule.priority}
                  </span>
                  {outcomes.hardStop && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      Hard Stop
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(rule)}
                    disabled={isPending}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    disabled={isPending}
                    className="p-1 hover:bg-muted rounded text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Form */}
      {isCreating ? (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">
            {editingRule ? "Edit Rule" : "New Rule"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            />
          </div>

          {/* Conditions */}
          <div>
            <label className="text-sm font-medium">Conditions (all must match)</label>
            <div className="space-y-2 mt-2">
              {conditions.map((cond, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={cond.field}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[i].field = e.target.value;
                      setConditions(updated);
                    }}
                    className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                  >
                    {LEAD_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[i].operator = e.target.value;
                      setConditions(updated);
                    }}
                    className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={String(cond.value ?? "")}
                    onChange={(e) => {
                      const updated = [...conditions];
                      const val = e.target.value;
                      if (
                        (cond.operator === "in" || cond.operator === "not_in") &&
                        val.includes(",")
                      ) {
                        updated[i].value = val.split(",").map((s) => s.trim());
                      } else {
                        updated[i].value = val;
                      }
                      setConditions(updated);
                    }}
                    placeholder="Value (comma-separated for lists)"
                    className="flex-1 h-9 rounded-md border border-input bg-card px-3 text-sm"
                  />
                  {conditions.length > 1 && (
                    <button
                      onClick={() =>
                        setConditions(conditions.filter((_, j) => j !== i))
                      }
                      className="p-1 hover:bg-muted rounded text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setConditions([
                    ...conditions,
                    { field: "state", operator: "equals", value: "" },
                  ])
                }
                className="text-sm text-primary hover:underline"
              >
                + Add condition
              </button>
            </div>
          </div>

          {/* Outcomes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Score Adjustment</label>
              <input
                type="number"
                value={scoreAdj}
                onChange={(e) => setScoreAdj(Number(e.target.value))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hardStop}
                onChange={(e) => setHardStop(e.target.checked)}
              />
              Hard Stop (immediately disqualify)
            </label>
            {hardStop && (
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="disqualify">Disqualify</option>
                <option value="refer">Refer Out</option>
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !name || !reason}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editingRule ? "Update Rule" : "Create Rule"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add Scoring Rule
        </button>
      )}
    </div>
  );
}
