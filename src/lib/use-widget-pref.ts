"use client";

import { useEffect, useState } from "react";

/**
 * Small persisted preference for a report widget (chart granularity, sort,
 * etc.). Remembered per browser under widget-pref:<key>. Use one per setting:
 *   const [granularity, setGranularity] = useWidgetPref("trends.granularity", "weekly");
 */
export function useWidgetPref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`widget-pref:${key}`);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(`widget-pref:${key}`, JSON.stringify(v));
    } catch { /* ignore */ }
  };

  return [value, update];
}
