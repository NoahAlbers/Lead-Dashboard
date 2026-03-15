"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTransition, useState } from "react";
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
  Mail,
  Phone,
  CheckCircle,
  Clock,
  Star,
  XCircle,
  Archive,
} from "lucide-react";
import { updateLeadStatus, archiveLead } from "@/actions/lead.actions";
import { logQuickAction } from "@/actions/note.actions";
import { toast } from "@/components/ui/use-toast";
import { EmailDialog } from "@/components/leads/email-dialog";
import type { LeadStatus, QualityTier } from "@prisma/client";

interface LeadRow {
  id: string;
  createdAt: string;
  companyName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  industry: string | null;
  serviceRequested: string | null;
  balanceAmount: number | null;
  score: number | null;
  qualityTier: QualityTier | null;
  recommendedAction: string | null;
  status: LeadStatus;
  lastActivityAt: string | null;
  isRead: boolean;
  assignedUser: { id: string; name: string } | null;
  recommendedReferral: { id: string; name: string } | null;
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
}

function SortableHeader({
  label,
  field,
  currentSort,
  currentDir,
}: {
  label: string;
  field: string;
  currentSort: string;
  currentDir: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSort() {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set("sortDirection", currentDir === "asc" ? "desc" : "asc");
    } else {
      params.set("sortField", field);
      params.set("sortDirection", "desc");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <button
      onClick={handleSort}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

function RowQuickActions({
  lead,
  onEmailClick,
}: {
  lead: LeadRow;
  onEmailClick: (lead: LeadRow) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(e: React.MouseEvent, newStatus: LeadStatus, label: string) {
    e.stopPropagation();
    startTransition(async () => {
      await updateLeadStatus(lead.id, newStatus);
      toast({
        title: `${lead.companyName || lead.fullName || "Lead"} marked as ${label}`,
        variant: "success",
      });
    });
  }

  function handleEmail(e: React.MouseEvent) {
    e.stopPropagation();
    onEmailClick(lead);
  }

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

  const btnBase =
    "action-btn relative rounded p-1 transition-all disabled:opacity-30";

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleEmail}
        disabled={!lead.email || isPending}
        className={`${btnBase} hover:bg-blue-50 text-blue-500`}
        data-tooltip="Email"
      >
        <Mail className="h-4 w-4" />
      </button>
      <button
        onClick={handleCall}
        disabled={!lead.phone || isPending}
        className={`${btnBase} hover:bg-sky-50 text-sky-500`}
        data-tooltip="Call"
      >
        <Phone className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "CONTACTED", "Contacted")}
        disabled={isPending}
        className={`${btnBase} hover:bg-green-50 text-green-600`}
        data-tooltip="Mark Contacted"
      >
        <CheckCircle className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "FOLLOW_UP_NEEDED", "Follow-Up")}
        disabled={isPending}
        className={`${btnBase} hover:bg-amber-50 text-amber-600`}
        data-tooltip="Follow-Up Needed"
      >
        <Clock className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "QUALIFIED", "Qualified")}
        disabled={isPending}
        className={`${btnBase} hover:bg-yellow-50 text-yellow-600`}
        data-tooltip="Mark Qualified"
      >
        <Star className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "DISQUALIFIED", "Disqualified")}
        disabled={isPending}
        className={`${btnBase} hover:bg-red-50 text-red-500`}
        data-tooltip="Disqualify"
      >
        <XCircle className="h-4 w-4" />
      </button>
      <button
        onClick={handleArchive}
        disabled={isPending}
        className={`${btnBase} hover:bg-muted text-muted-foreground`}
        data-tooltip="Archive"
      >
        <Archive className="h-4 w-4" />
      </button>
    </div>
  );
}

export function LeadTable({
  leads,
  total,
  page,
  pageSize,
  totalPages,
  sortField,
  sortDirection,
  emailTemplates = [],
}: LeadTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [emailDialogLead, setEmailDialogLead] = useState<LeadRow | null>(null);

  const columns: ColumnDef<LeadRow>[] = [
    {
      id: "readIndicator",
      header: "",
      size: 24,
      cell: ({ row }) => (
        <div className="flex items-center justify-center w-3">
          {!row.original.isRead && (
            <span className="block h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <SortableHeader
          label="Created"
          field="createdAt"
          currentSort={sortField}
          currentDir={sortDirection}
        />
      ),
      cell: ({ row }) =>
        format(toZonedTime(new Date(row.original.createdAt), "America/New_York"), "MM/dd/yy h:mm a", { timeZone: "America/New_York" }),
    },
    {
      accessorKey: "companyName",
      header: () => (
        <SortableHeader
          label="Company"
          field="companyName"
          currentSort={sortField}
          currentDir={sortDirection}
        />
      ),
      cell: ({ row }) => (
        <Link
          href={`/leads/${row.original.id}`}
          className="font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.companyName || "—"}
        </Link>
      ),
    },
    {
      accessorKey: "fullName",
      header: "Contact",
      cell: ({ row }) => row.original.fullName || "—",
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-xs">{row.original.email || "—"}</span>
      ),
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }) => {
        const state = row.original.state;
        if (!state) return "—";
        const states = state.split(",").map((s) => s.trim()).filter(Boolean);
        if (states.length <= 1) return <span className="text-xs">{state}</span>;
        return (
          <div className="flex flex-wrap gap-0.5">
            {states.slice(0, 3).map((s, i) => (
              <span key={i} className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                {s}
              </span>
            ))}
            {states.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{states.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "score",
      header: () => (
        <SortableHeader
          label="Score"
          field="score"
          currentSort={sortField}
          currentDir={sortDirection}
        />
      ),
      cell: ({ row }) => <ScoreBadge score={row.original.score} />,
    },
    {
      accessorKey: "qualityTier",
      header: "Tier",
      cell: ({ row }) => <TierBadge tier={row.original.qualityTier} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RowQuickActions
          lead={row.original}
          onEmailClick={(lead) => setEmailDialogLead(lead)}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
  });

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No leads found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const isUnread = !row.original.isRead;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${isUnread ? "font-semibold" : ""}`}
                      onClick={() => router.push(`/leads/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, total)} of {total} leads
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(1)}
            disabled={page <= 1}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={page >= totalPages}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Email Dialog */}
      {emailDialogLead && emailDialogLead.email && (
        <EmailDialog
          open={!!emailDialogLead}
          onClose={() => setEmailDialogLead(null)}
          lead={{
            id: emailDialogLead.id,
            email: emailDialogLead.email,
            fullName: emailDialogLead.fullName,
            companyName: emailDialogLead.companyName,
            phone: emailDialogLead.phone,
            state: emailDialogLead.state,
            industry: emailDialogLead.industry,
          }}
          templates={emailTemplates}
        />
      )}
    </div>
  );
}
