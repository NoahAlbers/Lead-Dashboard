"use client";

import { useState, useTransition, useCallback } from "react";
import { Trash2, Plus, RotateCcw, Save, GripVertical } from "lucide-react";
import { createCustomStatus, deleteCustomStatus, saveTierRanges } from "@/actions/status.actions";
import { unarchiveLead } from "@/actions/lead.actions";
import { createEmailType, updateEmailType, deleteEmailType } from "@/actions/email-type.actions";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PASTEL_COLORS = [
  "#FFB3B3", "#FFDAB3", "#FFF3B3", "#D4F5D4",
  "#B3E8D4", "#B3E8F5", "#B3D4FF", "#C7B3FF",
  "#E8B3FF", "#FFB3E8", "#F5D4B3", "#D4D4D4",
];

interface StatusItem {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

interface TierItem {
  id: string;
  name: string;
  color: string;
  min: number;
  max: number;
}

interface ArchivedLead {
  id: string;
  fullName: string | null;
  companyName: string | null;
  email: string | null;
  createdAt: string;
  score: number | null;
}

interface EmailTypeItem {
  id: string;
  name: string;
  color: string;
  isReferral: boolean;
  isDefault: boolean;
}

interface SettingsClientProps {
  statuses: StatusItem[];
  tiers: TierItem[];
  archivedLeads: ArchivedLead[];
  emailTypes: EmailTypeItem[];
}

// --- Status List (for lead statuses only) ---

function StatusList({ items }: { items: StatusItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PASTEL_COLORS[0]);

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createCustomStatus({ name: newName.trim(), color: newColor, type: "status" });
      setNewName("");
      setShowAdd(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCustomStatus(id);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Lead Statuses</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Status
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-muted/30 p-3 mb-3 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status name..."
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {PASTEL_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={`h-7 w-7 rounded-md border-2 transition-transform ${
                    newColor === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || isPending}
              className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(""); }}
              className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            {!item.isDefault && (
              <button
                onClick={() => handleDelete(item.id)}
                disabled={isPending}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Sortable Tier Card ---

function SortableTierCard({
  tier,
  onChange,
  onDelete,
  disabled,
}: {
  tier: TierItem;
  onChange: (id: string, field: string, value: string | number) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tier.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="h-6 w-6 rounded-full border-2 border-border shrink-0"
          style={{ backgroundColor: tier.color }}
        />
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 rounded-lg border bg-card shadow-lg z-20 flex flex-wrap gap-1.5 w-[180px]">
            {PASTEL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(tier.id, "color", c); setShowColorPicker(false); }}
                className={`h-6 w-6 rounded-md border-2 ${tier.color === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      <input
        type="text"
        value={tier.name}
        onChange={(e) => onChange(tier.id, "name", e.target.value)}
        className="flex-1 min-w-0 rounded border border-input bg-card px-2 py-1 text-sm font-medium"
      />

      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min={0}
          max={100}
          value={tier.min}
          onChange={(e) => onChange(tier.id, "min", Number(e.target.value))}
          className="w-14 rounded border border-input bg-card px-2 py-1 text-sm text-center"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="number"
          min={0}
          max={100}
          value={tier.max}
          onChange={(e) => onChange(tier.id, "max", Number(e.target.value))}
          className="w-14 rounded border border-input bg-card px-2 py-1 text-sm text-center"
        />
      </div>

      <button
        onClick={() => { if (confirm("Delete this tier?")) onDelete(tier.id); }}
        disabled={disabled}
        className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// --- Unified Tier Manager ---

function UnifiedTierManager({ initialTiers }: { initialTiers: TierItem[] }) {
  const [tiers, setTiers] = useState(initialTiers);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleChange(id: string, field: string, value: string | number) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  function handleDelete(id: string) {
    setTiers((prev) => prev.filter((t) => t.id !== id));
  }

  function handleAdd() {
    const newId = `tier-${Date.now()}`;
    setTiers((prev) => [
      ...prev,
      { id: newId, name: "New Tier", color: PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)], min: 0, max: 0 },
    ]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTiers((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id);
        const newIndex = prev.findIndex((t) => t.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleSave() {
    startTransition(async () => {
      await saveTierRanges(tiers);
      toast({ title: "Tiers updated", description: `Recalculating lead scores...`, variant: "success" });
    });
  }

  return (
    <div>
      <h2 className="font-semibold mb-1">Quality Tiers</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Drag to set priority (first match wins). Overlapping ranges are allowed.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tiers.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tiers.map((tier) => (
              <SortableTierCard
                key={tier.id}
                tier={tier}
                onChange={handleChange}
                onDelete={handleDelete}
                disabled={isPending}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Tier
        </button>
        <button
          onClick={handleSave}
          disabled={isPending || tiers.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save Tiers
        </button>
      </div>
    </div>
  );
}

// --- Main Settings Client ---

// --- Email Type Manager ---

function EmailTypeManager({ initialTypes }: { initialTypes: EmailTypeItem[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PASTEL_COLORS[0]);
  const [newIsReferral, setNewIsReferral] = useState(false);

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createEmailType({ name: newName.trim(), color: newColor, isReferral: newIsReferral });
      setNewName("");
      setShowAdd(false);
      setNewIsReferral(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this email type?")) return;
    startTransition(async () => {
      await deleteEmailType(id);
      setTypes((prev) => prev.filter((t) => t.id !== id));
    });
  }

  function handleToggleReferral(id: string, isReferral: boolean) {
    startTransition(async () => {
      await updateEmailType(id, { isReferral });
      setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, isReferral } : t)));
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Email Types</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Add Type
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-muted/30 p-3 mb-3 space-y-3">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Type name..." className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm" />
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {PASTEL_COLORS.map((color) => (
                <button key={color} onClick={() => setNewColor(color)} className={`h-7 w-7 rounded-md border-2 ${newColor === color ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newIsReferral} onChange={(e) => setNewIsReferral(e.target.checked)} />
            Referral type (for referring leads to partners)
          </label>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newName.trim() || isPending} className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add</button>
            <button onClick={() => setShowAdd(false)} className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {types.map((et) => (
          <div key={et.id} className="group flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: et.color }} />
              <span className="text-sm font-medium">{et.name}</span>
              {et.isReferral && <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1 py-0.5">Referral</span>}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleToggleReferral(et.id, !et.isReferral)} disabled={isPending} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted text-[10px]" title={et.isReferral ? "Unmark as referral" : "Mark as referral"}>
                {et.isReferral ? "R" : "·"}
              </button>
              <button onClick={() => handleDelete(et.id)} disabled={isPending} className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsClient({ statuses, tiers, archivedLeads, emailTypes }: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  function handleRestore(leadId: string) {
    startTransition(async () => {
      await unarchiveLead(leadId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5 space-y-6">
        <StatusList items={statuses} />
        <UnifiedTierManager initialTiers={tiers} />
        <EmailTypeManager initialTypes={emailTypes} />
      </div>

      {/* Archived Leads */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-3">Archived Leads</h2>
        {archivedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No archived leads.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name / Company</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Created</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {archivedLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{lead.companyName || lead.fullName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{lead.email || "—"}</td>
                    <td className="px-3 py-2 text-xs">{format(new Date(lead.createdAt), "MM/dd/yy")}</td>
                    <td className="px-3 py-2">{lead.score ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRestore(lead.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
