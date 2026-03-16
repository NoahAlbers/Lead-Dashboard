"use client";

import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    // Small delay to let content render
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
