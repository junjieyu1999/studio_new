"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useSyncExternalStore } from "react";
import { Artwork } from "@/types/artwork";
import { timeOfDayStore, type TimeMode } from "@/lib/time-of-day";
import { GalleryScene } from "./GalleryScene";
import { GuidedNavControls } from "./GuidedNavControls";

function useAutoMode(): TimeMode {
  return useSyncExternalStore(
    timeOfDayStore.subscribe,
    timeOfDayStore.getSnapshot,
    timeOfDayStore.getServerSnapshot
  );
}

export function GalleryCanvas({ artworks }: { artworks: Artwork[] }) {
  const [showHint, setShowHint] = useState(true);
  const autoMode = useAutoMode();
  // null = follow the viewer's local time; otherwise a manual override.
  const [override, setOverride] = useState<TimeMode | null>(null);
  const mode = override ?? autoMode;

  return (
    <div className="gallery-stage relative h-dvh w-full touch-none select-none overflow-hidden overscroll-none bg-[#0d0b09]">
      <Canvas
        shadows={false}
        camera={{ position: [0, 1.6, 0.5], fov: 62, near: 0.1, far: 60 }}
        onPointerDown={() => setShowHint(false)}
        dpr={[1, 1.75]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <GalleryScene artworks={artworks} mode={mode} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 text-center">
        <h1
          className={`text-sm font-medium tracking-[0.3em] ${
            mode === "day" ? "text-[#4a4034]/80" : "text-white/70"
          }`}
        >
          THE GALLERY
        </h1>
      </div>

      {/* Day / night toggle */}
      <button
        onClick={() => setOverride(mode === "day" ? "night" : "day")}
        aria-label={mode === "day" ? "Switch to evening" : "Switch to daylight"}
        title={
          override
            ? "Manual — tap to switch"
            : "Following your local time — tap to switch"
        }
        className={`pointer-events-auto absolute right-6 top-5 z-20 flex h-11 w-11 touch-none select-none items-center justify-center rounded-full border backdrop-blur-sm transition ${
          mode === "day"
            ? "border-black/10 bg-white/50 text-[#5a4a33] hover:bg-white/70"
            : "border-white/15 bg-black/40 text-[#e8c874] hover:bg-white/10"
        }`}
      >
        {mode === "day" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        )}
      </button>

      {showHint && (
        <div
          className={`pointer-events-none absolute left-1/2 top-16 z-10 w-[min(92vw,32rem)] -translate-x-1/2 rounded-2xl border px-4 py-2 text-center text-[0.7rem] leading-relaxed backdrop-blur-sm sm:rounded-full sm:text-xs ${
            mode === "day"
              ? "border-black/10 bg-white/45 text-[#4a4034]"
              : "border-white/15 bg-black/40 text-white/80"
          }`}
        >
          <span className="sm:hidden">
            Drag to look · arrows to walk the room · tap a painting
          </span>
          <span className="hidden sm:inline">
            Use Forward / Back to tour · drag to look · WASD to free-walk · click
            a painting to open it
          </span>
        </div>
      )}

      <GuidedNavControls mode={mode} />
    </div>
  );
}
