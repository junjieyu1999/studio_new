"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import { Artwork } from "@/types/artwork";
import { GalleryScene } from "./GalleryScene";
import { GuidedNavControls } from "./GuidedNavControls";
import { MobileControls } from "./MobileControls";

export function GalleryCanvas({ artworks }: { artworks: Artwork[] }) {
  const [showHint, setShowHint] = useState(true);

  return (
    <div className="gallery-stage relative h-dvh w-full touch-none select-none overflow-hidden overscroll-none bg-[#0e0d0c]">
      <Canvas
        shadows={false}
        camera={{ position: [0, 1.6, 0.5], fov: 62, near: 0.1, far: 60 }}
        onPointerDown={() => setShowHint(false)}
        dpr={[1, 1.75]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <GalleryScene artworks={artworks} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 text-center">
        <h1 className="text-sm font-medium tracking-[0.3em] text-white/70">
          THE GALLERY
        </h1>
      </div>

      {showHint && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 w-[min(92vw,32rem)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-center text-[0.7rem] leading-relaxed text-white/80 backdrop-blur-sm sm:rounded-full sm:text-xs">
          <span className="sm:hidden">
            Drag to look · arrows to walk · Forward/Back to tour · tap a painting
          </span>
          <span className="hidden sm:inline">
            Use Forward / Back to tour · drag to look · WASD to free-walk · click
            a painting to open it
          </span>
        </div>
      )}

      <GuidedNavControls />
      <MobileControls />
    </div>
  );
}
