"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import {
  commissionMailto,
  inquiryMailto,
  instagramUrl,
} from "@/lib/contact";
import { ArtworkWithImages } from "@/types/artwork";

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

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
          <div className="flex w-full items-center justify-center overflow-hidden rounded bg-[#e7e2d6]">
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={active.caption}
                className="block h-auto max-h-[82vh] w-auto max-w-full object-contain"
              />
            ) : null}
          </div>

          {allImages.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-3">
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-block rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${
                artwork.status === "available"
                  ? "border-emerald-700/30 text-emerald-800"
                  : artwork.status === "sold"
                  ? "border-[#1c1a17]/20 text-[#1c1a17]/60"
                  : "border-amber-700/30 text-amber-800"
              }`}
            >
              {STATUS_LABEL[artwork.status]}
            </span>

            {artwork.status !== "sold" && (
              <span className="font-serif text-2xl text-[#1c1a17]">
                {formatPrice(artwork.price) ?? "Price on request"}
              </span>
            )}
          </div>

          {/* Buy / enquire */}
          <div className="mt-6 rounded-2xl border border-[#8b6842]/25 bg-[#8b6842]/[0.05] p-5">
            <p className="font-serif text-xl">
              {artwork.status === "sold"
                ? "This piece is sold"
                : "Interested in this piece?"}
            </p>
            <p className="mt-1 text-sm text-[#1c1a17]/65">
              {artwork.status === "sold"
                ? "Get in touch about similar work or a commission."
                : "Message me to buy or ask a question — I'll get right back to you."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={inquiryMailto(artwork.title)}
                className="inline-flex items-center gap-2 rounded-full bg-[#8b6842] px-5 py-3 text-base font-medium text-white transition hover:opacity-90"
              >
                <MailGlyph />
                Enquire by email
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#1c1a17]/20 px-5 py-3 text-base font-medium transition hover:bg-black/[0.04]"
              >
                <InstagramGlyph />
                Message on Instagram
              </a>
            </div>
            <p className="mt-4 text-sm text-[#1c1a17]/60">
              Also open for commissions —{" "}
              <a
                href={commissionMailto()}
                className="text-[#8b6842] underline underline-offset-2"
              >
                request a custom piece
              </a>
              .
            </p>
          </div>

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
