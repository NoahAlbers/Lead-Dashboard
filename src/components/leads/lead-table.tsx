"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTransition, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { format, toZonedTime } from "date-fns-tz";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  MailOpen,
  Phone,
  CheckCircle,
  Clock,
  Star,
  XCircle,
  Archive,
  X,
  GripVertical,
  EyeOff,
  RotateCcw,
  Share2,
} from "lucide-react";
import { OutcomeModal } from "@/components/leads/outcome-modal";
import { useActionTip } from "@/components/leads/action-tooltip";
import { updateLeadStatus, archiveLead, toggleReadStatus, bulkMarkAsRead } from "@/actions/lead.actions";
import { logQuickAction } from "@/actions/note.actions";
import { toast } from "@/components/ui/use-toast";
import { EmailDialog } from "@/components/leads/email-dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LeadStatus } from "@prisma/client";
import { getStateColor } from "@/lib/state-colors";
import { SlaBadge } from "@/components/leads/sla-badge";
import { AgingBadge } from "@/components/leads/aging-badge";
import { AssignDropdown } from "@/components/leads/assign-dropdown";
import { BulkActionBar } from "@/components/leads/bulk-action-bar";
import { useKeyboardShortcuts } from "@/components/shared/keyboard-shortcut-provider";

interface LeadRow {
  id: string;
  createdAt: string;
  companyName: string | null;
  fullName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  states: string[] | null;
  rawPayloadJson?: Record<string, unknown> | null;
  industry: string | null;
  debtType: string | null;
  accountVolume: string | null;
  urgency: string | null;
  serviceRequested: string | null;
  businessType: string | null;
  balanceAmount: number | null;
  score: number | null;
  qualityTier: string | null;
  recommendedAction: string | null;
  status: LeadStatus;
  lastActivityAt: string | null;
  isRead: boolean;
  assignedUser: { id: string; name: string } | null;
  recommendedReferral: { id: string; name: string } | null;
  stateClassifications?: Record<string, string>;
  slaStatus: string | null;
  slaRemainingMinutes?: number | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

interface LeadTableProps {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortField: string;
  sortDirection: string;
  emailTemplates?: EmailTemplate[];
  stateClassifications?: Record<string, string>;
  tierColorMap?: Record<string, string>;
  filterBar?: React.ReactNode;
  userRole?: string;
  agingThresholds?: { green: number; yellow: number; orange: number; red: number };
  referralPartners?: Array<{
    id: string;
    name: string;
    contactName: string | null;
    email: string | null;
    emails: string[] | null;
    phone: string | null;
    website: string | null;
    statesServed: string[] | null;
    specialties: string[] | null;
    industries: string[] | null;
    minimumClaimSize: number | null;
    maximumClaimSize: number | null;
    notes: string | null;
  }>;
}

// --- All available column definitions ---
interface ColumnConfig {
  id: string;
  label: string;
  sortField?: string; // if sortable, the server field name
}

const ALL_COLUMNS: ColumnConfig[] = [
  { id: "readIndicator", label: "Read" },
  { id: "createdAt", label: "Created", sortField: "createdAt" },
  { id: "age", label: "Age", sortField: "createdAt" },
  { id: "companyName", label: "Company", sortField: "companyName" },
  { id: "fullName", label: "Contact", sortField: "fullName" },
  { id: "email", label: "Email", sortField: "email" },
  { id: "phone", label: "Phone", sortField: "phone" },
  { id: "state", label: "State", sortField: "state" },
  { id: "score", label: "Score", sortField: "score" },
  { id: "qualityTier", label: "Tier", sortField: "qualityTier" },
  { id: "status", label: "Status", sortField: "status" },
  { id: "recommendedAction", label: "Action", sortField: "recommendedAction" },
  { id: "industry", label: "Industry", sortField: "industry" },
  { id: "debtType", label: "Debt Type", sortField: "debtType" },
  { id: "accountVolume", label: "Units", sortField: "accountVolumeNum" },
  { id: "urgency", label: "Urgency", sortField: "urgency" },
  { id: "businessType", label: "Business Type", sortField: "businessType" },
  { id: "lastActivityAt", label: "Last Activity", sortField: "lastActivityAt" },
  { id: "sla", label: "SLA", sortField: "slaStatus" },
  { id: "actions", label: "Quick Actions" },
];

const DEFAULT_VISIBLE = new Set([
  "readIndicator", "createdAt", "age", "companyName", "accountVolume", "fullName", "email", "state",
  "score", "status", "actions",
]);
// Default order: the visible set in reading order, then everything else (hidden)
const DEFAULT_ORDER = [
  "readIndicator", "createdAt", "age", "companyName", "accountVolume", "fullName", "email", "state",
  "score", "status", "actions",
  ...ALL_COLUMNS.map((c) => c.id).filter((id) => ![
    "readIndicator", "createdAt", "age", "companyName", "accountVolume", "fullName", "email", "state",
    "score", "status", "actions",
  ].includes(id)),
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  readIndicator: 40, createdAt: 140, age: 60, companyName: 200, fullName: 140,
  email: 200, phone: 120, state: 80, score: 70, qualityTier: 70,
  status: 110, recommendedAction: 120, industry: 120, debtType: 120,
  accountVolume: 80, urgency: 80, businessType: 120, lastActivityAt: 100, sla: 110, actions: 220,
};

const STORAGE_KEY = "lead-table-config-v2";

function loadConfig(): { visible: Set<string>; order: string[]; widths: Record<string, number> } {
  if (typeof window === "undefined") return { visible: DEFAULT_VISIBLE, order: DEFAULT_ORDER, widths: DEFAULT_COLUMN_WIDTHS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visible: DEFAULT_VISIBLE, order: DEFAULT_ORDER, widths: DEFAULT_COLUMN_WIDTHS };
    const parsed = JSON.parse(raw);
    return {
      visible: new Set(parsed.visible ?? [...DEFAULT_VISIBLE]),
      order: parsed.order ?? DEFAULT_ORDER,
      widths: { ...DEFAULT_COLUMN_WIDTHS, ...(parsed.widths ?? {}) },
    };
  } catch {
    return { visible: DEFAULT_VISIBLE, order: DEFAULT_ORDER, widths: DEFAULT_COLUMN_WIDTHS };
  }
}

function saveConfig(visible: Set<string>, order: string[], widths?: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ visible: [...visible], order, widths: widths ?? DEFAULT_COLUMN_WIDTHS }));
}

// --- Sortable column row for picker modal ---
function SortableColumnRow({ id, label, checked, onToggle }: { id: string; label: string; checked: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground"><GripVertical className="h-3.5 w-3.5" /></button>
      <label className="flex items-center gap-2 flex-1 text-sm cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onToggle} className="rounded border-gray-300" />
        {label}
      </label>
    </div>
  );
}

// --- Quick Actions ---
function RowQuickActions({ lead, onEmailClick, onReferClick }: { lead: LeadRow; onEmailClick: (lead: LeadRow) => void; onReferClick: (lead: LeadRow) => void }) {
  const [isPending, startTransition] = useTransition();
  const { bind, tipEl } = useActionTip();

  function handleStatusChange(e: React.MouseEvent, newStatus: LeadStatus, label: string) {
    e.stopPropagation();
    startTransition(async () => {
      await updateLeadStatus(lead.id, newStatus);
      toast({ title: `${lead.companyName || lead.fullName || "Lead"} marked as ${label}`, variant: "success" });
    });
  }

  function handleEmail(e: React.MouseEvent) { e.stopPropagation(); onEmailClick(lead); }
  function handleCall(e: React.MouseEvent) {
    e.stopPropagation();
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, "_self");
      startTransition(async () => {
        await logQuickAction(lead.id, "contacted_phone");
        toast({ title: `Called ${lead.companyName || lead.fullName || "Lead"}`, variant: "success" });
      });
    }
  }
  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await archiveLead(lead.id);
      toast({ title: `${lead.companyName || lead.fullName || "Lead"} archived`, variant: "success" });
    });
  }

  const b = "relative rounded p-1 transition-all disabled:opacity-30";
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={handleEmail} disabled={!lead.email || isPending} className={`${b} hover:bg-blue-50 text-blue-500`} {...bind("Email")}><Mail className="h-4 w-4" /></button>
      <button onClick={handleCall} disabled={!lead.phone || isPending} className={`${b} hover:bg-sky-50 text-sky-500`} {...bind("Call")}><Phone className="h-4 w-4" /></button>
      <button onClick={(e) => handleStatusChange(e, "CONTACTED", "Contacted")} disabled={isPending} className={`${b} hover:bg-green-50 text-green-600`} {...bind("Mark Contacted")}><CheckCircle className="h-4 w-4" /></button>
      <button onClick={(e) => handleStatusChange(e, "FOLLOW_UP_NEEDED", "Follow-Up")} disabled={isPending} className={`${b} hover:bg-amber-50 text-amber-600`} {...bind("Follow-Up Needed")}><Clock className="h-4 w-4" /></button>
      <button onClick={(e) => handleStatusChange(e, "QUALIFIED", "Qualified")} disabled={isPending} className={`${b} hover:bg-yellow-50 text-yellow-600`} {...bind("Mark Qualified")}><Star className="h-4 w-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); onReferClick(lead); }} disabled={isPending} className={`${b} hover:bg-purple-50 text-purple-600`} {...bind("Refer Out")}><Share2 className="h-4 w-4" /></button>
      <button onClick={(e) => handleStatusChange(e, "DISQUALIFIED", "Disqualified")} disabled={isPending} className={`${b} hover:bg-red-50 text-red-500`} {...bind("Disqualify")}><XCircle className="h-4 w-4" /></button>
      <button onClick={handleArchive} disabled={isPending} className={`${b} hover:bg-muted text-muted-foreground`} {...bind("Archive")}><Archive className="h-4 w-4" /></button>
      <span onClick={(e) => e.stopPropagation()}>
        <AssignDropdown leadId={lead.id} currentAssigneeId={lead.assignedUser?.id} leadLabel={lead.companyName || lead.fullName || "Lead"} compact />
      </span>
      {tipEl}
    </div>
  );
}

// --- Main Component ---
export function LeadTable({ leads, total, page, pageSize, totalPages, sortField, sortDirection, emailTemplates = [], stateClassifications = {}, tierColorMap, filterBar, referralPartners = [], agingThresholds, userRole }: LeadTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [emailDialogLead, setEmailDialogLead] = useState<LeadRow | null>(null);
  const [referLead, setReferLead] = useState<LeadRow | null>(null);
  const [autoPartnerId, setAutoPartnerId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; colId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const lastClickedIndex = useRef<number>(-1);
  const { registerHandler } = useKeyboardShortcuts();

  // Reset focused index when leads change (new filter/page)
  useEffect(() => {
    setFocusedIndex(-1);
  }, [leads]);

  // Remember the inbox's current query (page, filters, sort) so the lead
  // page's "Back to Inbox" link can restore it.
  useEffect(() => {
    try {
      sessionStorage.setItem("leadsInboxQuery", searchParams.toString());
    } catch {}
  }, [searchParams]);

  // The Columns button lives in the filter bar (a separate component tree);
  // it signals us with a custom event, same pattern as focus-search.
  useEffect(() => {
    const open = () => setShowPicker(true);
    window.addEventListener("open-column-picker", open);
    return () => window.removeEventListener("open-column-picker", open);
  }, []);

  // Refer Out from the row quick actions: record the outcome, set the status,
  // then hand off to the email dialog pre-targeted at the chosen partner.
  async function handleReferConfirm(result?: { referralPartnerId?: string }) {
    if (!referLead) return;
    const lead = referLead;
    setReferLead(null);
    await updateLeadStatus(lead.id, "REFERRED_OUT");
    toast({ title: `${lead.companyName || lead.fullName || "Lead"} marked as Referred Out`, variant: "success" });
    if (result?.referralPartnerId && lead.email) {
      setAutoPartnerId(result.referralPartnerId);
      setEmailDialogLead(lead);
    }
    router.refresh();
  }

  // Register inbox keyboard shortcut handler
  useEffect(() => {
    const unregister = registerHandler("inbox", (key: string) => {
      if (leads.length === 0) return false;

      if (key === "j" || key === "ArrowDown") {
        setFocusedIndex((prev) => Math.min(prev + 1, leads.length - 1));
        return true;
      }
      if (key === "k" || key === "ArrowUp") {
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        return true;
      }
      if (key === "Enter" || key === "o") {
        setFocusedIndex((cur) => {
          if (cur >= 0 && cur < leads.length) {
            router.push(`/leads/${leads[cur].id}`);
          }
          return cur;
        });
        return focusedIndex >= 0;
      }
      if (key === "x") {
        setFocusedIndex((cur) => {
          if (cur >= 0 && cur < leads.length) {
            const lead = leads[cur];
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
              return next;
            });
          }
          return cur;
        });
        return focusedIndex >= 0;
      }
      if (key === "r") {
        setFocusedIndex((cur) => {
          if (cur >= 0 && cur < leads.length) {
            toggleReadStatus(leads[cur].id);
          }
          return cur;
        });
        return focusedIndex >= 0;
      }
      if (key === "w") {
        // Try to find and click the "Start Working" button
        const workingBtn = document.querySelector('[data-working-mode-trigger]') as HTMLButtonElement | null;
        if (workingBtn) {
          workingBtn.click();
          return true;
        }
        return false;
      }
      return false;
    });
    return unregister;
  }, [leads, focusedIndex, registerHandler, router]);

  // Column config from localStorage
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [colOrder, setColOrder] = useState<string[]>(DEFAULT_ORDER);
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);

  useEffect(() => {
    const cfg = loadConfig();
    setVisibleCols(cfg.visible);
    setColOrder(cfg.order);
    setColWidths(cfg.widths);
  }, []);

  useEffect(() => { saveConfig(visibleCols, colOrder, colWidths); }, [visibleCols, colOrder, colWidths]);

  // Column resize handler
  function handleResizeStart(e: React.MouseEvent, colId: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colId] ?? DEFAULT_COLUMN_WIDTHS[colId] ?? 100;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(40, startWidth + delta);
      setColWidths((prev) => ({ ...prev, [colId]: newWidth }));
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // Compute total table width for fixed layout
  const activeColumns = colOrder.filter((id) => visibleCols.has(id));
  const totalTableWidth = activeColumns.reduce((sum, id) => sum + (colWidths[id] ?? DEFAULT_COLUMN_WIDTHS[id] ?? 100), 0);

  // Close context menu on click outside
  useEffect(() => {
    function handler() { setContextMenu(null); }
    if (contextMenu) { document.addEventListener("click", handler); return () => document.removeEventListener("click", handler); }
  }, [contextMenu]);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleSort(field: string | undefined) {
    if (!field) return;
    const params = new URLSearchParams(searchParams.toString());
    if (sortField === field) {
      params.set("sortDirection", sortDirection === "asc" ? "desc" : "asc");
    } else {
      params.set("sortField", field);
      params.set("sortDirection", "desc");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Build cell renderers
  function renderCell(colId: string, row: LeadRow) {
    switch (colId) {
      case "readIndicator":
        return (
          <button
            className="flex items-center justify-center w-5 h-5"
            onClick={(e) => {
              e.stopPropagation();
              toggleReadStatus(row.id);
            }}
            title={row.isRead ? "Mark as unread" : "Mark as read"}
          >
            {!row.isRead ? (
              <Mail className="h-[18px] w-[18px] text-primary" />
            ) : (
              <MailOpen className="h-[18px] w-[18px] text-muted-foreground/40" />
            )}
          </button>
        );
      case "createdAt":
        return format(toZonedTime(new Date(row.createdAt), "America/New_York"), "MM/dd/yy h:mm a", { timeZone: "America/New_York" });
      case "companyName":
        return <Link href={`/leads/${row.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.companyName || "—"}</Link>;
      case "fullName":
        return row.fullName || "—";
      case "email":
        return <span className="text-xs">{row.email || "—"}</span>;
      case "phone":
        return <span className="text-xs">{row.phone || "—"}</span>;
      case "state": {
        // Prefer the states JSON array, fall back to single state string
        const statesArr = row.states && row.states.length > 0 ? row.states : (row.state ? row.state.split(",").map((x) => x.trim()).filter(Boolean) : []);
        if (statesArr.length === 0) return "—";
        if (statesArr.length === 1) {
          const cls = stateClassifications[statesArr[0].toUpperCase()] ?? "unknown";
          const colors = getStateColor(cls);
          return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>{statesArr[0]}</span>;
        }
        return (
          <div className="flex flex-wrap gap-0.5">
            {statesArr.slice(0, 3).map((x, i) => {
              const cls = stateClassifications[x.toUpperCase()] ?? "unknown";
              const colors = getStateColor(cls);
              return <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>{x}</span>;
            })}
            {statesArr.length > 3 && <span className="text-[10px] text-muted-foreground">+{statesArr.length - 3}</span>}
          </div>
        );
      }
      case "score":
        return <ScoreBadge score={row.score} />;
      case "qualityTier":
        return <TierBadge tier={row.qualityTier} colorMap={tierColorMap} />;
      case "status":
        return <StatusBadge status={row.status} />;
      case "recommendedAction":
        return row.recommendedAction ? <span className="text-xs capitalize">{row.recommendedAction.replace(/_/g, " ")}</span> : "—";
      case "industry":
        return <span className="text-xs">{row.industry || "—"}</span>;
      case "debtType":
        return <span className="text-xs truncate max-w-[120px] block">{row.debtType || "—"}</span>;
      case "accountVolume":
        return row.accountVolume || "—";
      case "urgency":
        return row.urgency ? <span className="text-xs capitalize">{row.urgency}</span> : "—";
      case "businessType":
        return <span className="text-xs">{row.businessType || "—"}</span>;
      case "lastActivityAt":
        return row.lastActivityAt ? format(toZonedTime(new Date(row.lastActivityAt), "America/New_York"), "MM/dd/yy", { timeZone: "America/New_York" }) : "—";
      case "sla":
        return <SlaBadge slaStatus={row.slaStatus} remainingMinutes={row.slaRemainingMinutes ?? undefined} compact />;
      case "age":
        return <AgingBadge createdAt={row.createdAt} thresholds={agingThresholds} />;
      case "actions":
        return <RowQuickActions lead={row} onEmailClick={(l) => setEmailDialogLead(l)} onReferClick={(l) => setReferLead(l)} />;
      default:
        return "—";
    }
  }

  const colConfigMap = Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, c]));

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  function changePageSize(newSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", String(newSize));
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetColumns() {
    setVisibleCols(new Set(DEFAULT_VISIBLE));
    setColOrder([...DEFAULT_ORDER]);
    setColWidths({ ...DEFAULT_COLUMN_WIDTHS });
  }

  function handlePickerDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} userRole={userRole} />

      {/* Filter bar (its Columns button opens our picker via a custom event) */}
      {filterBar}

      {/* Column Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPicker(false)}>
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-sm mx-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Customize Columns</h3>
              <button onClick={() => setShowPicker(false)} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePickerDragEnd}>
                <SortableContext items={colOrder} strategy={verticalListSortingStrategy}>
                  {colOrder.map((id) => {
                    const col = colConfigMap[id];
                    if (!col) return null;
                    return (
                      <SortableColumnRow
                        key={id}
                        id={id}
                        label={col.label}
                        checked={visibleCols.has(id)}
                        onToggle={() => {
                          setVisibleCols((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id); else next.add(id);
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
            <div className="p-3 border-t">
              <button onClick={resetColumns} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg border bg-card shadow-lg py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { setVisibleCols((prev) => { const n = new Set(prev); n.delete(contextMenu.colId); return n; }); setContextMenu(null); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide this column
          </button>
          {colConfigMap[contextMenu.colId]?.sortField && (
            <>
              <button
                onClick={() => { const p = new URLSearchParams(searchParams.toString()); p.set("sortField", colConfigMap[contextMenu.colId].sortField!); p.set("sortDirection", "asc"); p.set("page", "1"); router.push(`${pathname}?${p.toString()}`); setContextMenu(null); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Sort ascending
              </button>
              <button
                onClick={() => { const p = new URLSearchParams(searchParams.toString()); p.set("sortField", colConfigMap[contextMenu.colId].sortField!); p.set("sortDirection", "desc"); p.set("page", "1"); router.push(`${pathname}?${p.toString()}`); setContextMenu(null); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Sort descending
              </button>
            </>
          )}
          <button
            onClick={() => { resetColumns(); setContextMenu(null); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset column order
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: totalTableWidth }}>
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-2 py-3 w-10" style={{ width: 40, minWidth: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && leads.every((l) => selectedIds.has(l.id))}
                    onChange={() => {
                      if (leads.every((l) => selectedIds.has(l.id))) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(leads.map((l) => l.id)));
                      }
                    }}
                    className="rounded border-gray-300"
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
                {activeColumns.map((colId) => {
                  const col = colConfigMap[colId];
                  if (!col) return null;
                  const isSorted = col.sortField && sortField === col.sortField;
                  const w = colWidths[colId] ?? DEFAULT_COLUMN_WIDTHS[colId] ?? 100;
                  return (
                    <th
                      key={colId}
                      className="relative px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                      style={{ width: w, minWidth: 40 }}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, colId }); }}
                    >
                      {col.sortField ? (
                        <button
                          onClick={() => handleSort(col.sortField)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {col.label}
                          {isSorted ? (
                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.id === "readIndicator" ? "" : col.label
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
                        onMouseDown={(e) => handleResizeStart(e, colId)}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="px-4 py-12 text-center text-muted-foreground">No leads found</td>
                </tr>
              ) : (
                leads.map((lead, rowIndex) => (
                  <tr
                    key={lead.id}
                    className={`group border-b hover:bg-muted/30 transition-colors cursor-pointer ${!lead.isRead ? "font-semibold" : ""} ${rowIndex === focusedIndex ? "ring-2 ring-primary/50" : ""}`}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                  >
                    <td className="px-2 py-3" style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const isShift = e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey;
                          if (isShift && lastClickedIndex.current >= 0) {
                            const start = Math.min(lastClickedIndex.current, rowIndex);
                            const end = Math.max(lastClickedIndex.current, rowIndex);
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              for (let i = start; i <= end; i++) {
                                next.add(leads[i].id);
                              }
                              return next;
                            });
                          } else {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
                              return next;
                            });
                          }
                          lastClickedIndex.current = rowIndex;
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                    </td>
                    {activeColumns.map((colId) => (
                      <td key={colId} className="px-4 py-3 overflow-hidden text-ellipsis" style={{ width: colWidths[colId] ?? DEFAULT_COLUMN_WIDTHS[colId] ?? 100 }}>{renderCell(colId, lead)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} leads
          </p>
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Leads per page"
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => goToPage(1)} disabled={page <= 1} className="rounded p-1 hover:bg-muted disabled:opacity-50"><ChevronsLeft className="h-4 w-4" /></button>
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded p-1 hover:bg-muted disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-3 text-sm">Page {page} of {totalPages}</span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="rounded p-1 hover:bg-muted disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages} className="rounded p-1 hover:bg-muted disabled:opacity-50"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Email Dialog */}
      {emailDialogLead && emailDialogLead.email && (
        <EmailDialog
          open={!!emailDialogLead}
          onClose={() => { setEmailDialogLead(null); setAutoPartnerId(null); }}
          lead={{
            id: emailDialogLead.id,
            email: emailDialogLead.email,
            fullName: emailDialogLead.fullName,
            firstName: emailDialogLead.firstName,
            lastName: emailDialogLead.lastName,
            companyName: emailDialogLead.companyName,
            phone: emailDialogLead.phone,
            state: emailDialogLead.state,
            states: emailDialogLead.states,
            industry: emailDialogLead.industry,
            debtType: emailDialogLead.debtType,
            businessType: emailDialogLead.businessType,
            accountVolume: emailDialogLead.accountVolume,
            title: emailDialogLead.title,
          }}
          templates={emailTemplates}
          referralPartners={referralPartners}
          rawIntakeForm={
            (emailDialogLead.rawPayloadJson?._rawIntakeForm as Record<string, unknown>) ??
            emailDialogLead.rawPayloadJson ??
            null
          }
          autoReferralPartnerId={autoPartnerId}
        />
      )}

      {referLead && (
        <OutcomeModal
          open={true}
          onClose={() => setReferLead(null)}
          onConfirm={handleReferConfirm}
          leadId={referLead.id}
          outcomeType="referred_out"
          referralPartners={referralPartners.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
