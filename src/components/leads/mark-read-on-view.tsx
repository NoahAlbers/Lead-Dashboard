"use client";

import { useEffect, useRef } from "react";
import { markLeadAsRead } from "@/actions/lead.actions";

export function MarkReadOnView({ leadId, isRead }: { leadId: string; isRead: boolean }) {
  const marked = useRef(false);

  useEffect(() => {
    if (!isRead && !marked.current) {
      marked.current = true;
      markLeadAsRead(leadId).catch(() => {
        console.error("Failed to mark lead as read");
      });
    }
  }, [leadId, isRead]);

  return null;
}
