export interface ShortcutDef {
  keys: string;
  description: string;
  scope: "global" | "inbox" | "detail";
}

export const SHORTCUTS: ShortcutDef[] = [
  // Global
  { keys: "G I", description: "Go to Lead Inbox", scope: "global" },
  { keys: "G R", description: "Go to Reports", scope: "global" },
  { keys: "G A", description: "Go to Assignments", scope: "global" },
  { keys: "G S", description: "Go to Admin Settings", scope: "global" },
  { keys: "/", description: "Focus search bar", scope: "global" },
  { keys: "?", description: "Show shortcuts help", scope: "global" },
  { keys: "Esc", description: "Close modal / deselect", scope: "global" },
  // Inbox
  { keys: "J / \u2193", description: "Move down in table", scope: "inbox" },
  { keys: "K / \u2191", description: "Move up in table", scope: "inbox" },
  { keys: "Enter", description: "Open selected lead", scope: "inbox" },
  { keys: "X", description: "Toggle checkbox", scope: "inbox" },
  { keys: "R", description: "Toggle read/unread", scope: "inbox" },
  { keys: "W", description: "Start Working mode", scope: "inbox" },
  // Lead Detail
  { keys: "E", description: "Email lead", scope: "detail" },
  { keys: "C", description: "Call lead", scope: "detail" },
  { keys: "N", description: "Add note", scope: "detail" },
  { keys: "S", description: "Change status", scope: "detail" },
  { keys: "D", description: "Disqualify", scope: "detail" },
  { keys: "Q", description: "Mark qualified", scope: "detail" },
  { keys: "F", description: "Mark follow-up", scope: "detail" },
  { keys: "B", description: "Back to inbox", scope: "detail" },
  { keys: "\u2190 / \u2192", description: "Prev / Next lead (Working mode)", scope: "detail" },
];

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}
