"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUTS, type ShortcutDef } from "@/lib/keyboard-shortcuts";
import { useKeyboardShortcuts } from "@/components/shared/keyboard-shortcut-provider";

function ShortcutGroup({ title, shortcuts }: { title: string; shortcuts: ShortcutDef[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{s.description}</span>
            <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShortcutHelpModal() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const globalShortcuts: ShortcutDef[] = [
    { keys: "Ctrl K / \u2318 K", description: "Open command palette", scope: "global" },
    ...SHORTCUTS.filter((s) => s.scope === "global"),
  ];
  const inboxShortcuts = SHORTCUTS.filter((s) => s.scope === "inbox");
  const detailShortcuts = SHORTCUTS.filter((s) => s.scope === "detail");

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
          <ShortcutGroup title="Global" shortcuts={globalShortcuts} />
          <ShortcutGroup title="Inbox" shortcuts={inboxShortcuts} />
          <ShortcutGroup title="Lead Detail" shortcuts={detailShortcuts} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
