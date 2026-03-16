"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshContextValue {
  isPaused: boolean;
  lastRefreshAt: Date;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  manualRefresh: () => void;
  newLeadCount: number;
  setNewLeadCount: (n: number) => void;
  clearNewLeads: () => void;
  isRefreshing: boolean;
}

const AutoRefreshContext = createContext<AutoRefreshContextValue | null>(null);

const LS_KEY = "auto-refresh-interval";

export function AutoRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [intervalMs, setIntervalMsState] = useState(30000);
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const baselineCountRef = useRef<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const val = Number(stored);
        if (val === 0 || (val >= 5000 && val <= 300000)) {
          setIntervalMsState(val);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setIntervalMs = useCallback((ms: number) => {
    setIntervalMsState(ms);
    try {
      localStorage.setItem(LS_KEY, String(ms));
    } catch {
      // ignore
    }
  }, []);

  const doRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefreshAt(new Date());
    // router.refresh is sync call that triggers async re-render; approximate with timeout
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [router]);

  const checkNewLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/count");
      if (!res.ok) return;
      const data = await res.json();
      const count = data.count as number;
      if (baselineCountRef.current === null) {
        baselineCountRef.current = count;
      } else if (count > baselineCountRef.current) {
        setNewLeadCount(count - baselineCountRef.current);
      } else {
        setNewLeadCount(0);
      }
    } catch {
      // silently fail
    }
  }, []);

  const shouldSkipRefresh = useCallback(() => {
    // Don't refresh if a modal is open
    const hasModal = document.querySelector("[role='dialog']");
    if (hasModal) return true;
    // Don't refresh if an input/textarea is focused
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        (active as HTMLElement).isContentEditable)
    ) {
      return true;
    }
    return false;
  }, []);

  const tick = useCallback(() => {
    if (shouldSkipRefresh()) return;
    doRefresh();
    checkNewLeads();
  }, [doRefresh, checkNewLeads, shouldSkipRefresh]);

  // Visibility change handler
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
        // Immediately refresh when tab becomes visible
        doRefresh();
        checkNewLeads();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [doRefresh, checkNewLeads]);

  // Set up polling interval
  useEffect(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // intervalMs === 0 means "Off"
    if (intervalMs === 0 || isPaused) return;

    intervalIdRef.current = setInterval(tick, intervalMs);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [intervalMs, isPaused, tick]);

  // Fetch baseline count on mount
  useEffect(() => {
    checkNewLeads();
  }, [checkNewLeads]);

  const manualRefresh = useCallback(() => {
    doRefresh();
    checkNewLeads();
    // Reset baseline on manual refresh
    baselineCountRef.current = null;
    setNewLeadCount(0);
  }, [doRefresh, checkNewLeads]);

  const clearNewLeads = useCallback(() => {
    baselineCountRef.current = null;
    setNewLeadCount(0);
  }, []);

  return (
    <AutoRefreshContext.Provider
      value={{
        isPaused,
        lastRefreshAt,
        intervalMs,
        setIntervalMs,
        manualRefresh,
        newLeadCount,
        setNewLeadCount,
        clearNewLeads,
        isRefreshing,
      }}
    >
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefresh() {
  const ctx = useContext(AutoRefreshContext);
  if (!ctx) {
    throw new Error("useAutoRefresh must be used within AutoRefreshProvider");
  }
  return ctx;
}
