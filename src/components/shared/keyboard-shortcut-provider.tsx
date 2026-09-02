"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isInputFocused } from "@/lib/keyboard-shortcuts";
import { CommandPalette, OPEN_COMMAND_PALETTE_EVENT } from "@/components/shared/command-palette";

interface KeyboardShortcutContextValue {
  registerHandler: (scope: string, handler: (key: string) => boolean) => () => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue | null>(null);

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutContext);
  if (!ctx) throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutProvider");
  return ctx;
}

export function KeyboardShortcutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [gPending, setGPending] = useState(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef<Map<string, (key: string) => boolean>>(new Map());

  const registerHandler = useCallback((scope: string, handler: (key: string) => boolean) => {
    handlersRef.current.set(scope, handler);
    return () => {
      handlersRef.current.delete(scope);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key;

      // Ctrl/Cmd+K - open command palette (works even while typing in inputs)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
        return;
      }

      // Don't handle other shortcuts when typing in inputs
      if (isInputFocused()) return;

      // Handle G-prefix combos
      if (gPending) {
        setGPending(false);
        if (gTimeoutRef.current) {
          clearTimeout(gTimeoutRef.current);
          gTimeoutRef.current = null;
        }
        const lower = key.toLowerCase();
        if (lower === "i") { e.preventDefault(); router.push("/leads"); return; }
        if (lower === "r") { e.preventDefault(); router.push("/reports"); return; }
        if (lower === "a") { e.preventDefault(); router.push("/leads/assignments"); return; }
        if (lower === "s") { e.preventDefault(); router.push("/admin/settings"); return; }
        // If not a valid G combo, fall through
      }

      // G prefix start
      if (key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setGPending(true);
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = setTimeout(() => setGPending(false), 1000);
        return;
      }

      // ? - show help (shift+/ on most keyboards)
      if (key === "?") {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // / - focus search
      if (key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-search"));
        return;
      }

      // Esc - close modal
      if (key === "Escape") {
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        window.dispatchEvent(new CustomEvent("close-modal"));
        return;
      }

      // Delegate to registered scope handlers
      for (const handler of handlersRef.current.values()) {
        if (handler(key)) {
          e.preventDefault();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gPending, showHelp, router]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, []);

  return (
    <KeyboardShortcutContext.Provider value={{ registerHandler, showHelp, setShowHelp }}>
      {children}
      <CommandPalette />
    </KeyboardShortcutContext.Provider>
  );
}
