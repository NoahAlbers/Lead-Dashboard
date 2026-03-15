"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
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
  CheckCircle,
  Clock,
  Star,
  XCircle,
} from "lucide-react";
import { updateLeadStatus } from "@/actions/lead.actions";
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
  assignedUser: { id: string; name: string } | null;
  recommendedReferral: { id: string; name: string } | null;
}

interface LeadTableProps {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortField: string;
  sortDirection: string;
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

function RowQuickActions({ lead }: { lead: LeadRow }) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(e: React.MouseEvent, newStatus: LeadStatus) {
    e.stopPropagation();
    startTransition(async () => {
      await updateLeadStatus(lead.id, newStatus);
    });
  }

  const iconBtn =
    "rounded p-1 transition-all disabled:opacity-30 opacity-0 group-hover:opacity-100";

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={(e) => handleStatusChange(e, "CONTACTED")}
        disabled={isPending}
        className={`${iconBtn} hover:bg-green-50 text-green-600`}
        title="Mark Contacted"
      >
        <CheckCircle className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "FOLLOW_UP_NEEDED")}
        disabled={isPending}
        className={`${iconBtn} hover:bg-amber-50 text-amber-600`}
        title="Follow-Up Needed"
      >
        <Clock className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "QUALIFIED")}
        disabled={isPending}
        className={`${iconBtn} hover:bg-blue-50 text-blue-600`}
        title="Mark Qualified"
      >
        <Star className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={(e) => handleStatusChange(e, "DISQUALIFIED")}
        disabled={isPending}
        className={`${iconBtn} hover:bg-red-50 text-red-500`}
        title="Disqualify"
      >
        <XCircle className="h-3.5 w-3.5" />
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
}: LeadTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns: ColumnDef<LeadRow>[] = [
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
      cell: ({ row }) => <RowQuickActions lead={row.original} />,
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
                  const isNew = row.original.status === "NEW";
                  return (
                    <tr
                      key={row.id}
                      className={`group border-b hover:bg-muted/30 transition-colors cursor-pointer ${isNew ? "font-semibold" : ""}`}
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
    </div>
  );
}
