"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * "Back to Inbox" link that restores the inbox exactly as the user left it
 * (page, filters, sort) — the lead table saves its query string to
 * sessionStorage on every change.
 */
export function BackToInboxLink() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      setQuery(sessionStorage.getItem("leadsInboxQuery") ?? "");
    } catch {}
  }, []);

  return (
    <Link
      href={query ? `/leads?${query}` : "/leads"}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Inbox
    </Link>
  );
}
