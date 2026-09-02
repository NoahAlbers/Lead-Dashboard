"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Merge } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { searchLeadsForMerge } from "@/actions/merge.actions";

interface SearchResult {
  id: string;
  companyName: string | null;
  fullName: string | null;
  email: string | null;
  score: number | null;
  qualityTier: string | null;
  status: string;
  createdAt: string;
}

interface MergeSearchDialogProps {
  open: boolean;
  onClose: () => void;
  currentLeadId: string;
}

export function MergeSearchDialog({ open, onClose, currentLeadId }: MergeSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    if (query.length < 2) return;
    startTransition(async () => {
      const data = await searchLeadsForMerge(query, currentLeadId);
      setResults(data);
    });
  }

  function handleSelect(targetId: string) {
    onClose();
    router.push(`/leads/merge?leadA=${currentLeadId}&leadB=${targetId}`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent size="lg" scrollable>
        <DialogHeader>
          <DialogTitle>Find lead to merge with</DialogTitle>
          <DialogDescription className="sr-only">
            Search for another lead and pick one to merge with this lead.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by company, name, email..."
                aria-label="Search leads"
                className="w-full h-9 rounded-md border border-input bg-card pl-9 pr-3 text-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isPending || query.length < 2}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Search
            </button>
          </form>

          <div className="mt-4 max-h-[400px] overflow-y-auto space-y-1">
            {results.length === 0 && query.length >= 2 && !isPending && (
              <p className="text-sm text-muted-foreground text-center py-4">No matching leads found.</p>
            )}
            {results.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => handleSelect(lead.id)}
                className="w-full flex items-center justify-between rounded-md border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{lead.companyName || lead.fullName || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{lead.email ?? "No email"} · Score: {lead.score ?? "n/a"} · {lead.status}</p>
                </div>
                <Merge className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
