"use client";

import dynamic from "next/dynamic";
import type { Artwork } from "@/types/artwork";

function GallerySpinner() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[#0d0b09]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#e8c874]" />
      <p className="font-serif text-lg text-white/80">Loading the gallery…</p>
    </div>
  );
}

// The 3D gallery pulls in Three.js / R3F / postprocessing — a large bundle.
// Load it as its own client-only chunk so the page paints a spinner instantly
// instead of blocking on the whole library.
const GalleryCanvas = dynamic(
  () => import("./GalleryCanvas").then((m) => ({ default: m.GalleryCanvas })),
  { ssr: false, loading: () => <GallerySpinner /> }
);

export function GalleryMount({ artworks }: { artworks: Artwork[] }) {
  return <GalleryCanvas artworks={artworks} />;
}
