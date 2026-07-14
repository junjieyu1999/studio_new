"use client";

import Link from "next/link";
import { useState } from "react";
import { ArtworkWithImages } from "@/types/artwork";

const STATUS_LABEL: Record<ArtworkWithImages["status"], string> = {
  available: "Available",
  sold: "Sold",
  "in-progress": "In progress",
};

export function ArtworkDetail({ artwork }: { artwork: ArtworkWithImages }) {
  // artwork_images may include the main image again as slot 0 — dedupe by URL.
  const allImages = [
    ...(artwork.image_url
      ? [{ url: artwork.image_url, caption: artwork.title }]
      : []),
    ...artwork.images
      .filter((img) => img.url !== artwork.image_url)
      .map((img) => ({ url: img.url, caption: img.caption ?? artwork.title })),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = allImages[activeIndex] ?? allImages[0];

  return (
    <div className="min-h-dvh bg-[#f4f1ea] text-[#1c1a17]">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="font-mono text-[0.68rem] tracking-[0.22em] text-[#1c1a17]/70 hover:text-[#1c1a17]"
        >
          ← BACK TO GALLERY
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 pb-24 sm:px-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="aspect-[4/5] w-full overflow-hidden bg-[#e7e2d6]">
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={active.caption}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          {allImages.length > 1 && (
            <div className="mt-4 flex gap-3">
              {allImages.map((img, i) => (
                <button
                  key={img.url + i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-20 w-20 overflow-hidden border-2 transition ${
                    i === activeIndex
                      ? "border-[#1c1a17]"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.caption}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
            {artwork.title}
          </h1>
          <p className="mt-3 text-sm text-[#1c1a17]/60">
            {artwork.year} · {artwork.medium} · {artwork.dimensions}
          </p>

          <span
            className={`mt-4 inline-block rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${
              artwork.status === "available"
                ? "border-emerald-700/30 text-emerald-800"
                : artwork.status === "sold"
                ? "border-[#1c1a17]/20 text-[#1c1a17]/60"
                : "border-amber-700/30 text-amber-800"
            }`}
          >
            {STATUS_LABEL[artwork.status]}
          </span>

          {artwork.description && (
            <p className="mt-8 text-base leading-relaxed text-[#1c1a17]/85">
              {artwork.description}
            </p>
          )}

          {artwork.inspiration && (
            <div className="mt-8">
              <h2 className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#8b6842]">
                INSPIRATION
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#1c1a17]/80">
                {artwork.inspiration}
              </p>
            </div>
          )}

          {artwork.process && (
            <div className="mt-8">
              <h2 className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#8b6842]">
                PROCESS
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#1c1a17]/80">
                {artwork.process}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
