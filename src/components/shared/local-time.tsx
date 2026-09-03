"use client";

import { useEffect, useState } from "react";

// A visitor's timezone, written the way a person would say it: the zone's own
// abbreviation and the time it is there right now, ticking on its own so a
// screen left open does not go stale.
//
// Abbreviations follow the calendar, so a New York visitor reads EDT through
// the summer and EST once the clocks go back. Zones with no letters of their
// own fall back to their offset (GMT+5:30), which is what a clock there shows.

function abbreviation(timezone: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return name || timezone;
  } catch {
    return timezone;
  }
}

function timeThere(timezone: string, at: Date): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    })
      .format(at)
      .toLowerCase()
      .replace(/\s/g, "");
  } catch {
    return null;
  }
}

/** "EDT (2:37pm)" for a known zone, or a quiet fallback when we have none. */
export function LocalTime({
  timezone,
  fallback = "Unknown",
  className,
}: {
  timezone: string | null | undefined;
  fallback?: string;
  className?: string;
}) {
  // Rendering the clock only after mount keeps the server and the first client
  // paint identical, which matters because the two run in different zones.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(tick);
  }, []);

  if (!timezone) return <span className={className}>{fallback}</span>;
  if (!now) {
    return (
      <span className={className} title={timezone}>
        {timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone}
      </span>
    );
  }

  const zone = abbreviation(timezone, now);
  const clock = timeThere(timezone, now);
  return (
    <span className={className} title={timezone}>
      {zone}
      {clock ? ` (${clock})` : ""}
    </span>
  );
}
