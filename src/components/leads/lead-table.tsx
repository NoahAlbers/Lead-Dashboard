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
import { format } from "date-fns";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Mail,
  Phone,
  Archive,
} from "lucide-react";
import { archiveLead } from "@/actions/lead.actions";
import { logQuickAction } from "@/actions/note.actions";
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

function QuickActions({ lead }: { lead: LeadRow }) {
  const [isPending, startTransition] = useTransition();

  function handleEmail(e: React.MouseEvent) {
    e.stopPropagation();
    if (lead.email) {
      window.open(`mailto:${lead.email}`, "_self");
      startTransition(async () => {
        await logQuickAction(lead.id, "contacted_email");
      });
    }
  }

  function handleCall(e: React.MouseEvent) {
    e.stopPropagation();
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, "_self");
      startTransition(async () => {
        await logQuickAction(lead.id, "contacted_phone");
      });
    }
  }

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await archiveLead(lead.id);
    });
  }

  const iconBtn =
    "rounded p-1 transition-colors disabled:opacity-30";

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleEmail}
        disabled={!lead.email || isPending}
        className={`${iconBtn} hover:bg-blue-50 text-blue-500`}
        title="Email"
      >
        <Mail className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleCall}
        disabled={!lead.phone || isPending}
        className={`${iconBtn} hover:bg-green-50 text-green-500`}
        title="Call"
      >
        <Phone className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleArchive}
        disabled={isPending}
        className={`${iconBtn} hover:bg-muted text-muted-foreground`}
        title="Archive"
      >
        <Archive className="h-3.5 w-3.5" />
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
        format(new Date(row.original.createdAt), "MM/dd/yy h:mm a"),
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
      accessorKey: "recommendedAction",
      header: "Action",
      cell: ({ row }) => {
        const action = row.original.recommendedAction;
        if (!action) return "—";
        return (
          <span className="text-xs capitalize">
            {action.replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      accessorKey: "assignedUser",
      header: "Assigned",
      cell: ({ row }) => row.original.assignedUser?.name || "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <QuickActions lead={row.original} />,
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
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
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
                ))
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
