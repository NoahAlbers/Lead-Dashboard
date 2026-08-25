"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal-based tooltip for icon action buttons. The CSS-only approach broke
 * inside the leads table — every <td> is overflow-hidden, which clips an
 * absolutely-positioned tooltip to a sliver. Rendering into document.body with
 * fixed positioning escapes any clipping or stacking context.
 *
 * Usage:
 *   const { bind, tipEl } = useActionTip();
 *   <button {...bind("Email")}>…</button>
 *   {tipEl}
 */
export function useActionTip() {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);

  function bind(label: string) {
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTip({ x: r.left + r.width / 2, y: r.bottom + 6, label });
      },
      onMouseLeave: () => setTip(null),
      onMouseDown: () => setTip(null),
    };
  }

  const tipEl =
    tip && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{
              position: "fixed",
              left: tip.x,
              top: tip.y,
              transform: "translateX(-50%)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="rounded-md bg-[#1A1A2E] px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap shadow-md"
          >
            {tip.label}
          </div>,
          document.body
        )
      : null;

  return { bind, tipEl };
}
