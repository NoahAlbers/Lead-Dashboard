"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, User, Handshake, Mail, Compass, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { globalSearch, type SearchResult, type SearchResultGroup } from "@/actions/search.actions";

export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";

const KIND_ICONS = {
  lead: User,
  partner: Handshake,
  template: Mail,
  nav: Compass,
} as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestSeq = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Open on custom event from anywhere (header button, provider shortcut)
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpen);
  }, []);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setGroups([]);
      setActiveIndex(0);
      setLoading(false);
    }
  }, [open]);

  // Debounced search while open
  useEffect(() => {
    if (!open) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    const delay = query.trim() ? 200 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await globalSearch(query);
        if (seq !== requestSeq.current) return;
        setGroups(result);
        setActiveIndex(0);
      } catch {
        if (seq !== requestSeq.current) return;
        setGroups([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [open, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const select = useCallback(
    (item: SearchResult) => {
      setOpen(false);
      router.push(item.href);
    },
    [router]
  );

  // Keep the active row visible
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length) setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length) setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) select(item);
    }
  }

  let runningIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Let the input take focus without Radix picking the first button
            e.preventDefault();
            const input = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>("input");
            input?.focus();
          }}
          className={cn(
            "fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150"
          )}
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogPrimitive.Description className="sr-only">
            Search leads, partners, templates, and pages
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search leads, partners, templates, or pages"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded
              aria-controls="command-palette-results"
              aria-activedescendant={flat[activeIndex] ? `command-palette-item-${activeIndex}` : undefined}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                Esc
              </kbd>
            )}
          </div>

          <div
            ref={listRef}
            id="command-palette-results"
            role="listbox"
            className={cn("max-h-[60vh] overflow-y-auto py-2 transition-opacity", loading && "opacity-60")}
          >
            {groups.length === 0 && !loading && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {query.trim() ? "No results" : "Start typing to search"}
              </p>
            )}
            {groups.map((group) => (
              <div key={group.key} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const index = runningIndex++;
                  const Icon = KIND_ICONS[item.kind];
                  const active = index === activeIndex;
                  return (
                    <div
                      key={`${item.kind}:${item.id}`}
                      id={`command-palette-item-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => select(item)}
                      className={cn(
                        "mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm",
                        active ? "bg-accent text-accent-foreground" : "text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.label}</div>
                        {item.sublabel && (
                          <div className="truncate text-xs text-muted-foreground">{item.sublabel}</div>
                        )}
                      </div>
                      {item.status && <StatusBadge status={item.status} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>&uarr;&darr; navigate</span>
            <span aria-hidden>&middot;</span>
            <span>Enter open</span>
            <span aria-hidden>&middot;</span>
            <span>Esc close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
