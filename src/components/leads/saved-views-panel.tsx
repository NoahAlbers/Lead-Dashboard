"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Bookmark,
  Users,
  User,
  EyeOff,
  Trash2,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useState, useTransition, useRef, useEffect } from "react";
import {
  createSavedView,
  deleteSavedView,
  hideSavedView,
  restoreSavedView,
  getHiddenViews,
} from "@/actions/saved-view.actions";
import { toast } from "@/components/ui/use-toast";

interface SavedView {
  id: string;
  name: string;
  filtersJson: Record<string, string> | null;
  sortJson: Record<string, string> | null;
  isTeamView: boolean;
  isSystem: boolean;
  userId: string | null;
}

interface SavedViewsPanelProps {
  views: SavedView[];
  currentUserId: string;
  userRole: string;
}

export function SavedViewsPanel({
  views,
  currentUserId,
  userRole,
}: SavedViewsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLDivElement>(null);

  const [showPanel, setShowPanel] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRestoreList, setShowRestoreList] = useState(false);
  const [hiddenViews, setHiddenViews] = useState<SavedView[]>([]);
  const [newName, setNewName] = useState("");
  const [isTeamView, setIsTeamView] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canCreateTeamView = ["ADMIN", "MANAGER"].includes(userRole);
  const teamViews = views.filter((v) => v.isTeamView);
  const myViews = views.filter((v) => !v.isTeamView);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
        setShowCreateForm(false);
        setShowRestoreList(false);
        setConfirmDeleteId(null);
      }
    }
    if (showPanel) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPanel]);

  function resolveFilterValue(key: string, value: string): string {
    if (key === "assignedUserId" && value === "__me__") {
      return currentUserId;
    }
    if (key === "dateFrom") {
      if (value === "__today__") {
        return new Date().toISOString().slice(0, 10);
      }
      if (value === "__week_start__") {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff)).toISOString().slice(0, 10);
      }
    }
    return value;
  }

  function applyView(view: SavedView) {
    const params = new URLSearchParams();
    if (view.filtersJson) {
      for (const [k, v] of Object.entries(view.filtersJson)) {
        params.set(k, resolveFilterValue(k, v));
      }
    }
    if (view.sortJson) {
      for (const [k, v] of Object.entries(view.sortJson)) {
        params.set(k, v);
      }
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
    setShowPanel(false);
  }

  function handleHide(id: string) {
    startTransition(async () => {
      try {
        await hideSavedView(id);
        toast({ title: "View hidden", description: "You can restore it from the Views menu." });
      } catch (e: unknown) {
        toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      }
    });
  }

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    startTransition(async () => {
      try {
        await deleteSavedView(id);
        setConfirmDeleteId(null);
        toast({ title: "View deleted" });
      } catch (e: unknown) {
        toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      }
    });
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const filtersJson: Record<string, string> = {};
    const sortJson: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key === "page" || key === "pageSize") return;
      if (key === "sortField" || key === "sortDirection") {
        sortJson[key] = value;
      } else {
        filtersJson[key] = value;
      }
    });

    startTransition(async () => {
      try {
        await createSavedView({
          name: newName.trim(),
          filtersJson,
          sortJson: Object.keys(sortJson).length > 0 ? sortJson : undefined,
          isTeamView: canCreateTeamView ? isTeamView : false,
        });
        setNewName("");
        setIsTeamView(false);
        setShowCreateForm(false);
        toast({ title: "View saved" });
      } catch (e: unknown) {
        toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      }
    });
  }

  async function handleShowRestore() {
    setShowRestoreList(true);
    try {
      const hidden = await getHiddenViews();
      setHiddenViews(
        hidden.map((v) => ({
          id: v.id,
          name: v.name,
          filtersJson: v.filtersJson as Record<string, string> | null,
          sortJson: v.sortJson as Record<string, string> | null,
          isTeamView: v.isTeamView,
          isSystem: v.isSystem,
          userId: v.userId,
        }))
      );
    } catch {
      setHiddenViews([]);
    }
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      try {
        await restoreSavedView(id);
        setHiddenViews((prev) => prev.filter((v) => v.id !== id));
        toast({ title: "View restored" });
      } catch (e: unknown) {
        toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setShowPanel(!showPanel);
          setShowCreateForm(false);
          setShowRestoreList(false);
          setConfirmDeleteId(null);
        }}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Views
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border bg-card shadow-lg z-50 py-1 max-h-[70vh] overflow-y-auto">
          {/* Team Views */}
          {teamViews.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Team Views
              </div>
              {teamViews.map((view) => (
                <div
                  key={view.id}
                  className="group flex items-center justify-between px-3 py-1.5 hover:bg-muted"
                >
                  <button
                    onClick={() => applyView(view)}
                    className="flex-1 text-left text-sm truncate"
                  >
                    {view.name}
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleHide(view.id)}
                      className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground"
                      title="Hide view"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                    {!view.isSystem && (
                      <button
                        onClick={() => handleDelete(view.id)}
                        className={`p-1 rounded hover:bg-muted-foreground/10 ${
                          confirmDeleteId === view.id
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                        title={
                          confirmDeleteId === view.id
                            ? "Click again to confirm"
                            : "Delete view"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* My Views */}
          {myViews.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mt-1">
                <User className="h-3 w-3" />
                My Views
              </div>
              {myViews.map((view) => (
                <div
                  key={view.id}
                  className="group flex items-center justify-between px-3 py-1.5 hover:bg-muted"
                >
                  <button
                    onClick={() => applyView(view)}
                    className="flex-1 text-left text-sm truncate"
                  >
                    {view.name}
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDelete(view.id)}
                      className={`p-1 rounded hover:bg-muted-foreground/10 ${
                        confirmDeleteId === view.id
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                      title={
                        confirmDeleteId === view.id
                          ? "Click again to confirm"
                          : "Delete view"
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {teamViews.length === 0 && myViews.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              No saved views yet
            </div>
          )}

          {/* Divider */}
          <div className="border-t my-1" />

          {/* Save Current View */}
          {!showCreateForm && !showRestoreList && (
            <div className="px-2 py-1 flex flex-col gap-1">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              >
                <Plus className="h-3.5 w-3.5" />
                Save Current View
              </button>
              <button
                onClick={handleShowRestore}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore Hidden Views
              </button>
            </div>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Save View
                </span>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="View name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
              {canCreateTeamView && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTeamView}
                    onChange={(e) => setIsTeamView(e.target.checked)}
                    className="rounded border-input"
                  />
                  Share with team
                </label>
              )}
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || isPending}
                className="w-full h-8 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save View"}
              </button>
            </div>
          )}

          {/* Restore Hidden Views */}
          {showRestoreList && (
            <div className="px-3 py-2 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Hidden Views
                </span>
                <button
                  onClick={() => setShowRestoreList(false)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {hiddenViews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No hidden views
                </p>
              ) : (
                hiddenViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm truncate">{view.name}</span>
                    <button
                      onClick={() => handleRestore(view.id)}
                      disabled={isPending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
