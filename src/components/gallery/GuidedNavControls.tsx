"use client";

import { useEffect, useState } from "react";
import { guidedNav, stepBackward, stepForward } from "@/lib/guided-nav";
import type { TimeMode } from "@/lib/time-of-day";

export function GuidedNavControls({ mode }: { mode: TimeMode }) {
  const [pos, setPos] = useState({ index: 0, total: 0 });

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setPos((prev) =>
        prev.index !== guidedNav.index || prev.total !== guidedNav.stops.length
          ? { index: guidedNav.index, total: guidedNav.stops.length }
          : prev
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const atStart = pos.index <= 0;
  const atEnd = pos.total > 0 && pos.index >= pos.total - 1;

  const isDay = mode === "day";
  // These arrows are the only way to move on touch, so they're sized generously.
  const btn = `pointer-events-auto flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border text-2xl backdrop-blur-sm transition disabled:cursor-not-allowed disabled:opacity-25 sm:h-12 sm:w-auto sm:gap-2 sm:px-5 sm:text-sm ${
    isDay
      ? "border-black/10 bg-white/55 text-[#4a4034] enabled:hover:bg-white/75"
      : "border-white/20 bg-black/45 text-white/90 enabled:hover:bg-white/15"
  }`;

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 sm:gap-2">
      <button
        onClick={stepBackward}
        disabled={atStart}
        aria-label="Previous artwork"
        className={btn}
      >
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">Back</span>
      </button>

      {pos.total > 0 && (
        <span
          className={`pointer-events-none min-w-[3.5rem] rounded-full border px-3 py-2 text-center text-xs tabular-nums backdrop-blur-sm ${
            isDay
              ? "border-black/10 bg-white/40 text-[#4a4034]/80"
              : "border-white/10 bg-black/30 text-white/70"
          }`}
        >
          {pos.index + 1} / {pos.total}
        </span>
      )}

      <button
        onClick={stepForward}
        disabled={atEnd}
        aria-label="Next artwork"
        className={btn}
      >
        <span className="hidden sm:inline">Forward</span>
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
