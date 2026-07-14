"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT, emailUrl, instagramUrl } from "@/lib/contact";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function ContactWidget() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanding card */}
      <div
        className={`w-64 origin-bottom-right rounded-2xl border border-white/10 bg-[#1c1a17]/95 p-3 text-[#f2ece0] shadow-2xl backdrop-blur-md transition-all duration-200 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
        role="dialog"
        aria-label="Contact"
      >
        <div className="px-2 pb-2 pt-1">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-[#b89355]">
            Get in touch
          </p>
          <p className="mt-1 font-serif text-lg leading-tight">Let&rsquo;s talk</p>
        </div>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.06]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#f2ece0] transition group-hover:text-[#e8c874]">
            <InstagramIcon />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.62rem] uppercase tracking-wide text-white/45">
              Instagram
            </span>
            <span className="block truncate text-sm">@{CONTACT.instagramHandle}</span>
          </span>
        </a>

        <a
          href={emailUrl}
          className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.06]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#f2ece0] transition group-hover:text-[#e8c874]">
            <MailIcon />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.62rem] uppercase tracking-wide text-white/45">
              Email
            </span>
            <span className="block truncate text-sm">{CONTACT.email}</span>
          </span>
        </a>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close contact options" : "Contact me"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8b6842] text-white shadow-lg shadow-black/25 transition hover:scale-105 hover:bg-[#7a5c39] active:scale-95"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
            <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.05-3.85A8.5 8.5 0 1 1 21 11.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}
