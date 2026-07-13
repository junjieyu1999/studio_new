"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const PHILOSOPHY = [
  {
    label: "On looking",
    heading: "I see what most people miss.",
    body: [
      "Everything starts with observation — sometimes for days before anything is made. I am not interested in surfaces. I am interested in what sits underneath them: the weight a person carries, the way a coastline holds its breath before a wave, the specific quality of light that makes an ordinary moment worth remembering.",
      "I wait for that thing to reveal itself. Some people call it inspiration. I call it patience with your eyes open.",
    ],
  },
  {
    label: "On people",
    heading: "There is no good or evil. Only everything in between.",
    body: [
      "When I paint people, I am not painting a likeness. I am painting the complexity that makes them who they are — the contradictions, the histories, the quiet forces that shape every decision they've ever made.",
      "I don't believe in clean moral lines. People are gray areas, and I want my portraits to hold that. When you look at a face in my work, I want you to feel like you still don't quite have the full story. Because you don't. Neither do I.",
    ],
  },
  {
    label: "On landscapes",
    heading: "Peace inside chaos.",
    body: [
      "The sea is never just the sea. There is always a stillness buried inside the violence of it — a moment of held breath between the chaos. That tension is what I am chasing in every landscape I make.",
      "I am not documenting geography. I am trying to freeze a feeling — the particular atmosphere of a place at a specific moment in time that will never exist again. Travel feeds this. Every new place shows me the world through a new set of eyes.",
    ],
  },
];

const FACTS: [string, string][] = [
  ["Based in", "Singapore"],
  ["Primary subjects", "Portraits, landscapes"],
  ["Signature", "Smudging it out, leaving it raw"],
  ["Commissions", "Open — enquire"],
  ["Driven by", "Places, people, conflict"],
];

const PROCESS = [
  {
    n: "01",
    title: "Observation",
    body: "Everything starts outside the studio. I watch, absorb, and wait. I am looking for the specific thing that makes this subject worth making at all — the feeling underneath the surface.",
  },
  {
    n: "02",
    title: "Atmosphere",
    body: "Before I make a mark I build the mood. Music that fits the emotional register of what I am trying to say. A mental map of where I want to go.",
  },
  {
    n: "03",
    title: "Sketching and testing",
    body: "Ideas get tested before they reach the canvas. Rough sketches, quick studies — I need to know if something works before I commit. This is where most ideas either sharpen or fall away.",
  },
  {
    n: "04",
    title: "The making",
    body: "Once I am working, I work. Failures on the canvas are not mistakes, they are occurrences. I build around them, incorporate them, let them become part of the piece.",
  },
  {
    n: "05",
    title: "Knowing when to stop",
    body: "A piece is finished when I step back and see my original vision looking back at me. Not when it is technically complete. When I recognize what I felt at the beginning.",
  },
];

export default function AboutPage() {
  const [active, setActive] = useState(0);

  return (
    <div className="min-h-dvh bg-[#f4f1ea] text-[#1c1a17]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-[#f4f1ea]/90 px-6 py-4 backdrop-blur-sm sm:px-10">
        <Link
          href="/"
          className="text-xs font-medium tracking-[0.25em] text-[#1c1a17]/70 transition hover:text-[#1c1a17]"
        >
          ← BACK TO GALLERY
        </Link>
        <span className="font-serif text-lg tracking-wide">Yu Jun Jie</span>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-16 sm:px-10 md:grid-cols-[1fr_320px] md:items-end">
        <div>
          <p className="mb-5 flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.25em] text-[#8b6842]">
            <span className="inline-block h-px w-5 bg-[#8b6842]" />
            About the artist
          </p>
          <h1 className="font-serif text-5xl font-light leading-none sm:text-7xl">
            Yu <em className="not-italic text-[#8b6842] italic">Jun Jie</em>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[#1c1a17]/60">
            Artist based in Singapore. Portraits and landscapes — chasing the
            tension inside stillness and the gray areas where the real human
            story lives.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-black/15 px-5 py-2.5 text-xs font-medium transition hover:border-black/30 hover:bg-black/[0.03]"
            >
              View the work →
            </Link>
          </div>
        </div>

        <div>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t bg-[#e7e2d6]">
            <Image
              src="/artist-photo.jpg"
              alt="Yu Jun Jie"
              fill
              sizes="320px"
              className="object-cover object-top"
              priority
            />
          </div>
          <p className="border-t border-black/10 py-2.5 text-center font-mono text-[0.58rem] uppercase tracking-[0.15em] text-[#1c1a17]/50">
            Studio, Singapore · 2026
          </p>
        </div>
      </section>

      {/* Bio + facts */}
      <section className="border-t border-black/10 bg-[#efece5]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 py-16 sm:px-10 md:grid-cols-[3fr_2fr]">
          <div>
            <h2 className="mb-6 inline-block border-b border-black/10 pb-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#8b6842]">
              Background
            </h2>
            <div className="space-y-5 text-[0.92rem] leading-[1.9] text-[#1c1a17]/75">
              <p>
                I make art because I have to. It is how I process the world —
                past, present, and future. It is the only way I know to release
                what I see that others seem to walk straight past. The layers
                underneath things. The tension inside stillness. The gray area
                where most of the real human story lives.
              </p>
              <p>
                Traveling is my primary fuel. Every new place puts me in front
                of people living their day-to-day lives in ways I haven’t seen
                before, and that recalibrates everything. Singapore grounds me,
                but the work is shaped by everywhere I’ve moved through.
              </p>
              <p>
                I work in bursts. Periods of deep observation and waiting,
                followed by intense focused making. I don’t force the work. I
                wait until I have something to say, and then I say it as
                honestly as I can.
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-6 inline-block border-b border-black/10 pb-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#8b6842]">
              At a glance
            </h2>
            <dl className="border-t border-black/10">
              {FACTS.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 border-b border-black/10 py-3"
                >
                  <dt className="text-[0.68rem] uppercase tracking-[0.08em] text-[#1c1a17]/50">
                    {k}
                  </dt>
                  <dd className="text-right font-serif text-[0.92rem]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="border-t border-black/10">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
          <h2 className="mb-2 inline-block border-b border-black/10 pb-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#8b6842]">
            Philosophy
          </h2>
          <h3 className="mb-10 font-serif text-3xl font-light sm:text-4xl">
            How I think about making work
          </h3>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-[200px_1fr]">
            <div className="flex flex-row flex-wrap gap-1 md:flex-col">
              {PHILOSOPHY.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setActive(i)}
                  className={`border-l-2 px-3 py-2 text-left text-sm transition ${
                    active === i
                      ? "border-[#8b6842] bg-[#8b6842]/[0.07] text-[#1c1a17]"
                      : "border-transparent text-[#1c1a17]/55 hover:text-[#1c1a17]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div key={active} className="animate-[fadeIn_0.3s_ease]">
              <h4 className="mb-6 font-serif text-2xl font-light italic leading-snug sm:text-3xl">
                {PHILOSOPHY[active].heading}
              </h4>
              <div className="space-y-5 text-[0.92rem] leading-[1.9] text-[#1c1a17]/75">
                {PHILOSOPHY[active].body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="border-t border-black/10 bg-[#efece5]">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
          <h2 className="mb-2 inline-block border-b border-black/10 pb-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#8b6842]">
            Process
          </h2>
          <h3 className="mb-10 font-serif text-3xl font-light sm:text-4xl">
            How a piece gets made
          </h3>
          <div className="border-t border-black/10">
            {PROCESS.map((step) => (
              <div
                key={step.n}
                className="grid grid-cols-[50px_1fr] gap-6 border-b border-black/10 py-7 sm:grid-cols-[80px_1fr]"
              >
                <div className="pt-1 font-mono text-xs tracking-[0.15em] text-[#8b6842]">
                  {step.n}
                </div>
                <div>
                  <div className="mb-2 font-serif text-lg">{step.title}</div>
                  <p className="text-sm leading-[1.85] text-[#1c1a17]/65">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-xl border border-black/10 bg-[#efece5] p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-serif text-2xl font-light">
              Want to see the work in person?
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#1c1a17]/60">
              Step back into the gallery and walk the room — each piece opens to
              its own story.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full bg-[#8b6842] px-6 py-3 text-xs font-medium text-white transition hover:opacity-90"
          >
            Enter the gallery →
          </Link>
        </div>
      </section>
    </div>
  );
}
