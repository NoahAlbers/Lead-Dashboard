"use client";

import { useEffect, useRef } from "react";
import { getUnreadCount } from "@/actions/lead.actions";

function getFaviconPath(count: number): string {
  if (count <= 0) return "/favicons/default.webp";
  if (count >= 20) return "/favicons/19+-unread.webp";
  return `/favicons/${count}-unread.webp`;
}

function setFavicon(path: string) {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = path;
  link.type = "image/webp";
}

export function FaviconManager() {
  const lastCount = useRef(-1);

  useEffect(() => {
    async function update() {
      try {
        const count = await getUnreadCount();
        if (count !== lastCount.current) {
          lastCount.current = count;
          setFavicon(getFaviconPath(count));

          // Update title prefix
          const baseTitle = "ACB Lead Operations Console";
          document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
        }
      } catch {
        // Silently fail — don't break the app over a favicon
      }
    }

    update();
    const interval = setInterval(update, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return null;
}
