"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Merge } from "lucide-react";
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-lg mx-4 max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Find Lead to Merge With</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by company, name, email..."
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
                onClick={() => handleSelect(lead.id)}
                className="w-full flex items-center justify-between rounded-md border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{lead.companyName || lead.fullName || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{lead.email ?? "No email"} · Score: {lead.score ?? "—"} · {lead.status}</p>
                </div>
                <Merge className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
