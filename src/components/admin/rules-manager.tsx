"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createRule, updateRule, deleteRule, toggleRule, reorderRules } from "@/actions/rule.actions";
import { Plus, Pencil, Trash2, RefreshCw, GripVertical, Save, Undo2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScoringSimulator } from "@/components/admin/scoring-simulator";

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

const LEAD_FIELD_GROUPS: Array<{ label: string; fields: string[] }> = [
  { label: "Contact", fields: ["fullName", "companyName", "email", "phone", "alternatePhone"] },
  { label: "Location", fields: ["state", "state_classification", "city", "zip", "country"] },
  { label: "Business / Case", fields: ["industry", "debtType", "balanceAmount", "estimatedClaimValue", "accountVolume", "serviceRequested", "notesFromForm", "urgency", "businessType"] },
  { label: "Portfolio (Residential)", fields: ["ownershipType", "rentalTypes", "propertyTypes", "avgRent", "listingSites", "pmSoftware", "debtsNow", "priorAgency"] },
  { label: "Metadata", fields: ["source", "leadSource", "referrer"] },
];

function SortableRuleRow({
  rule,
  disabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: Rule;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const outcomes = rule.outcomesJson as RuleOutcome;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-4 ${!rule.enabled ? "opacity-60" : ""} ${isDragging ? "shadow-lg relative z-10" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300"
            />
          </label>
          <div className="min-w-0">
            <p className="font-medium truncate">{rule.name}</p>
            {rule.description && (
              <p className="text-sm text-muted-foreground truncate">
                {rule.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
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
            onClick={onEdit}
            disabled={disabled}
            className="p-1 hover:bg-muted rounded"
            aria-label="Edit rule"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={disabled}
            className="p-1 hover:bg-muted rounded text-destructive"
            aria-label="Delete rule"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function RulesManager({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [recalculating, setRecalculating] = useState(false);
  const [confirmState, setConfirmState] = useState<{ action: () => void } | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Pick up fresh rules from the server after a refresh, unless the user has an unsaved order.
  useEffect(() => {
    if (!orderDirty) setRules(initialRules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRules]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRules((prev) => {
      const oldIdx = prev.findIndex((r) => r.id === active.id);
      const newIdx = prev.findIndex((r) => r.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx).map((r, i) => ({ ...r, priority: i }));
    });
    setOrderDirty(true);
  }

  function handleSaveOrder() {
    setSavingOrder(true);
    setRecalculating(true);
    startTransition(async () => {
      try {
        const result = await reorderRules(rules.map((r) => r.id));
        setOrderDirty(false);
        showRecalcToast(result.recalculatedCount);
        router.refresh();
      } catch (err) {
        toast({ title: "Could not save order", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      } finally {
        setSavingOrder(false);
        setRecalculating(false);
      }
    });
  }

  function handleResetOrder() {
    setRules(initialRules);
    setOrderDirty(false);
  }

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
    setConfirmState({
      action: () => {
        setRecalculating(true);
        startTransition(async () => {
          const result = await deleteRule(id);
          setRules((prev) => prev.filter((r) => r.id !== id));
          setRecalculating(false);
          showRecalcToast(result.recalculatedCount);
        });
      },
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    setRecalculating(true);
    startTransition(async () => {
      const result = await toggleRule(id, enabled);
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
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

      {/* Unsaved order bar */}
      {orderDirty && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <span>Rule order changed. Save to persist the new priorities and recalculate lead scores.</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetOrder}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={isPending || savingOrder}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save order
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scoring rules yet. Every lead starts at a base score of 50.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Drag rules to set priority. Rules run top to bottom; the first hard stop wins.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rules.map((rule) => (
              <SortableRuleRow
                key={rule.id}
                rule={rule}
                disabled={isPending}
                onToggle={(enabled) => handleToggle(rule.id, enabled)}
                onEdit={() => startEdit(rule)}
                onDelete={() => handleDelete(rule.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
                    {LEAD_FIELD_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.fields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </optgroup>
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

      <ScoringSimulator
        rules={rules.map((r) => ({
          name: r.name,
          enabled: r.enabled,
          priority: r.priority,
          conditionsJson: r.conditionsJson as RuleCondition[],
          outcomesJson: r.outcomesJson as RuleOutcome,
        }))}
        orderDirty={orderDirty}
      />

      <ConfirmDialog
        open={!!confirmState}
        title="Delete Rule"
        message="Are you sure you want to delete this scoring rule? All lead scores will be recalculated."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { confirmState?.action(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
