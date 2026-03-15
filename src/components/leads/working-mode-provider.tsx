"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface DispositionRecord {
  leadId: string;
  disposition: string;
  timestamp: number;
}

interface WorkingModeContextValue {
  isWorkingMode: boolean;
  queue: string[];
  currentIndex: number;
  sessionStartTime: number | null;
  dispositions: DispositionRecord[];
  enterWorkingMode: (queue: string[]) => void;
  exitWorkingMode: () => void;
  goToNext: () => string | null;
  goToPrevious: () => string | null;
  skip: () => string | null;
  recordDispositionInSession: (leadId: string, disposition: string) => void;
  setCurrentIndex: (index: number) => void;
}

const WorkingModeContext = createContext<WorkingModeContextValue>({
  isWorkingMode: false,
  queue: [],
  currentIndex: 0,
  sessionStartTime: null,
  dispositions: [],
  enterWorkingMode: () => {},
  exitWorkingMode: () => {},
  goToNext: () => null,
  goToPrevious: () => null,
  skip: () => null,
  recordDispositionInSession: () => {},
  setCurrentIndex: () => {},
});

export function useWorkingMode() {
  return useContext(WorkingModeContext);
}

export function WorkingModeProvider({ children }: { children: ReactNode }) {
  const [isWorkingMode, setIsWorkingMode] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [dispositions, setDispositions] = useState<DispositionRecord[]>([]);

  const enterWorkingMode = useCallback((newQueue: string[]) => {
    setQueue(newQueue);
    setCurrentIndex(0);
    setSessionStartTime(Date.now());
    setDispositions([]);
    setIsWorkingMode(true);
  }, []);

  const exitWorkingMode = useCallback(() => {
    setIsWorkingMode(false);
  }, []);

  const goToNext = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      return queue[next];
    }
    return null;
  }, [currentIndex, queue]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      return queue[prev];
    }
    return null;
  }, [currentIndex, queue]);

  const skip = useCallback(() => {
    return goToNext();
  }, [goToNext]);

  const recordDispositionInSession = useCallback((leadId: string, disposition: string) => {
    setDispositions((prev) => [...prev, { leadId, disposition, timestamp: Date.now() }]);
  }, []);

  return (
    <WorkingModeContext.Provider
      value={{
        isWorkingMode,
        queue,
        currentIndex,
        sessionStartTime,
        dispositions,
        enterWorkingMode,
        exitWorkingMode,
        goToNext,
        goToPrevious,
        skip,
        recordDispositionInSession,
        setCurrentIndex,
      }}
    >
      {children}
    </WorkingModeContext.Provider>
  );
}
