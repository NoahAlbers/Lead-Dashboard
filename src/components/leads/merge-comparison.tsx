"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Merge } from "lucide-react";
import { performMerge } from "@/actions/merge.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import type { FieldSelection } from "@/services/merge.service";

interface LeadData {
  id: string;
  [key: string]: unknown;
}

const COMPARE_FIELDS: { key: string; label: string; isArray?: boolean }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "fullName", label: "Full Name" },
  { key: "companyName", label: "Company" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "alternatePhone", label: "Alt Phone" },
  { key: "address1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "states", label: "States", isArray: true },
  { key: "zip", label: "Zip" },
  { key: "industry", label: "Industry" },
  { key: "debtType", label: "Debt Type" },
  { key: "balanceAmount", label: "Balance" },
  { key: "accountVolume", label: "Units" },
  { key: "serviceRequested", label: "Service Requested" },
  { key: "urgency", label: "Urgency" },
  { key: "businessType", label: "Business Type" },
  { key: "notesFromForm", label: "Notes from Form" },
  { key: "leadSource", label: "Source" },
];

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) return val.join(", ") || "—";
  if (typeof val === "number") return val.toLocaleString();
  return String(val) || "—";
}

interface MergeComparisonProps {
  leadA: LeadData;
  leadB: LeadData;
}

export function MergeComparison({ leadA, leadB }: MergeComparisonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [primaryId, setPrimaryId] = useState(leadA.id); // Default: A is primary
  const [selections, setSelections] = useState<Record<string, "A" | "B" | "union">>(() => {
    const initial: Record<string, "A" | "B" | "union"> = {};
    for (const field of COMPARE_FIELDS) {
      const aVal = formatValue(leadA[field.key]);
      const bVal = formatValue(leadB[field.key]);
      if (aVal === bVal) {
        initial[field.key] = "A"; // identical
      } else if (aVal === "—" && bVal !== "—") {
        initial[field.key] = "B"; // auto-select non-empty
      } else if (bVal === "—" && aVal !== "—") {
        initial[field.key] = "A";
      } else if (field.isArray) {
        initial[field.key] = "union"; // default union for arrays
      } else {
        initial[field.key] = "A"; // default to primary
      }
    }
    return initial;
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const primary = primaryId === leadA.id ? leadA : leadB;
  const duplicate = primaryId === leadA.id ? leadB : leadA;

  function handleSwapPrimary() {
    setPrimaryId(primaryId === leadA.id ? leadB.id : leadA.id);
  }

  function handleMerge() {
    const fieldSelections: FieldSelection[] = Object.entries(selections).map(([field, source]) => {
      // Remap A/B based on which is primary
      let actualSource = source;
      if (source !== "union") {
        if (primaryId === leadA.id) {
          actualSource = source; // A=primary, B=duplicate
        } else {
          actualSource = source === "A" ? "B" : "A"; // swap
        }
      }
      return { field, source: actualSource };
    });

    startTransition(async () => {
      await performMerge(primary.id as string, duplicate.id as string, fieldSelections);
      toast({ title: "Leads merged successfully", variant: "success" });
      router.push(`/leads/${primary.id}`);
    });
  }

  const diffCount = COMPARE_FIELDS.filter((f) => {
    const a = formatValue(leadA[f.key]);
    const b = formatValue(leadB[f.key]);
    return a !== b && a !== "—" && b !== "—";
  }).length;

  return (
    <div className="space-y-4">
      {/* Primary toggle */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <div className="text-sm">
          <span className="font-medium">Primary:</span>{" "}
          <span className="text-primary font-semibold">{formatValue(primary.companyName) || formatValue(primary.fullName)}</span>
          <span className="text-muted-foreground ml-2">({diffCount} field conflicts)</span>
        </div>
        <button
          onClick={handleSwapPrimary}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Swap Primary
        </button>
      </div>

      {/* Field comparison table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-36">Field</th>
              <th className="px-3 py-2 text-left font-medium text-primary">
                Lead A {primaryId === leadA.id && "(Primary)"}
              </th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">Use</th>
              <th className="px-3 py-2 text-left font-medium text-primary">
                Lead B {primaryId === leadB.id && "(Primary)"}
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_FIELDS.map((field) => {
              const aVal = formatValue(leadA[field.key]);
              const bVal = formatValue(leadB[field.key]);
              const identical = aVal === bVal;
              const sel = selections[field.key];

              return (
                <tr key={field.key} className={`border-b last:border-0 ${identical ? "" : "bg-amber-50/50"}`}>
                  <td className="px-3 py-2 font-medium text-muted-foreground">{field.label}</td>
                  <td
                    className={`px-3 py-2 cursor-pointer transition-colors ${sel === "A" ? "bg-primary/10 font-medium" : "hover:bg-muted/50"}`}
                    onClick={() => setSelections({ ...selections, [field.key]: "A" })}
                  >
                    <div className="flex items-center gap-1.5">
                      {sel === "A" && <Check className="h-3 w-3 text-primary shrink-0" />}
                      <span className="truncate">{aVal}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {field.isArray && !identical && (
                      <button
                        onClick={() => setSelections({ ...selections, [field.key]: "union" })}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sel === "union" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        Both
                      </button>
                    )}
                    {identical && <span className="text-[10px] text-green-600">Same</span>}
                  </td>
                  <td
                    className={`px-3 py-2 cursor-pointer transition-colors ${sel === "B" ? "bg-primary/10 font-medium" : "hover:bg-muted/50"}`}
                    onClick={() => setSelections({ ...selections, [field.key]: "B" })}
                  >
                    <div className="flex items-center gap-1.5">
                      {sel === "B" && <Check className="h-3 w-3 text-primary shrink-0" />}
                      <span className="truncate">{bVal}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Merge button */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => router.back()}
          className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Merge className="h-4 w-4" />
          {isPending ? "Merging..." : "Merge Leads"}
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Merge"
        message={`Keep "${formatValue(primary.companyName) || formatValue(primary.fullName)}" as primary. The duplicate will be archived. All activity and notes will be combined. This can be undone within 24 hours.`}
        confirmLabel="Merge"
        onConfirm={() => { setShowConfirm(false); handleMerge(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
