"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ScrollToTop
 * Rendered via createPortal onto document.body so it fully escapes every
 * parent container (including the sidebar layout and the Tailwind wrapper).
 * This guarantees position: fixed; right: 0 actually sits at the visual
 * right edge of the viewport regardless of any overflow/transform parents.
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!mounted || !visible) return null;

  const btn = (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Scroll to top"
      style={{
        position: "fixed",
        right: 0,
        bottom: 80,
        width: 40,
        height: 40,
        /* flat right edge so button appears as a tab poking from the screen edge */
        borderRadius: "8px 0 0 8px",
        background: "#7c3aed",
        border: "none",
        color: "#ffffff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "-3px 2px 14px rgba(0,0,0,0.22)",
        zIndex: 2147483647, /* max possible z-index */
        transition: "width 0.18s ease",
        outline: "none",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.width = "50px";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.width = "40px";
      }}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );

  return createPortal(btn, document.body);
}
