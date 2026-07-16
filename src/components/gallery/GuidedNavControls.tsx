"use client";

import { useEffect, useState } from "react";
import { guidedNav, stepBackward, stepForward } from "@/lib/guided-nav";

export function GuidedNavControls() {
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

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
      <button
        onClick={stepBackward}
        disabled={atStart}
        aria-label="Previous artwork"
        className="pointer-events-auto flex h-12 touch-none select-none items-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 text-sm text-white/90 backdrop-blur-sm transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">Back</span>
      </button>

      {pos.total > 0 && (
        <span className="pointer-events-none min-w-[3.5rem] rounded-full border border-white/10 bg-black/30 px-3 py-2 text-center text-xs tabular-nums text-white/70 backdrop-blur-sm">
          {pos.index + 1} / {pos.total}
        </span>
      )}

      <button
        onClick={stepForward}
        disabled={atEnd}
        aria-label="Next artwork"
        className="pointer-events-auto flex h-12 touch-none select-none items-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 text-sm text-white/90 backdrop-blur-sm transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span className="hidden sm:inline">Forward</span>
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
