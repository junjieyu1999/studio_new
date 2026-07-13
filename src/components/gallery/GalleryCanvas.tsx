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
    <div className="relative h-dvh w-full bg-[#0e0d0c]">
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
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-5 py-2 text-center text-xs text-white/80 backdrop-blur-sm">
          Use Forward / Back to tour · drag to look · WASD to free-walk · click a
          painting to open it
        </div>
      )}

      <GuidedNavControls />
      <MobileControls />
    </div>
  );
}
