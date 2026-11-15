'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './PostcardsPage.module.css';
import { emailUrl } from '@/lib/contact';
import { POSTCARD_FORM_URL, addMonths, formatMonth, type PublicIssue } from '@/lib/mail';

const DEFAULT_GRADIENT = 'linear-gradient(145deg,#C4A87A 0%,#8B6842 60%,#5C3D1E 100%)';

// Widths of the placeholder "handwriting" lines on the back of the postcard.
const LINES_A = ['92%', '78%', '85%'];
const LINES_B = ['88%', '95%', '70%', '54%'];

interface Props {
  issues: PublicIssue[]; // oldest first
}

// ─────────────────────────────────────────────────────────────────
// A postcard you can turn over. Front = the artwork, back = the writing.
// ─────────────────────────────────────────────────────────────────
function PostcardVisual({ issue }: { issue: PublicIssue | null }) {
  const [flipped, setFlipped] = useState(false);
  const art = issue?.artwork ?? null;

  const caption = issue
    ? `${formatMonth(issue.issue_month)} · ${issue.city}`
    : 'Your first city, revealed in the post';

  return (
    <div className={styles.visual}>
      <div
        className={styles.stage}
        role="img"
        aria-label="A postcard. The front shows an original print of the artwork of the month. The back holds trip highlights and a personal story."
      >
        <div className={`${styles.ghostCard} ${styles.ghostA}`} aria-hidden="true" />
        <div className={`${styles.ghostCard} ${styles.ghostB}`} aria-hidden="true" />

        <div className={`${styles.flipper} ${flipped ? styles.flipped : ''}`} aria-hidden="true">
          {/* Front */}
          <div className={`${styles.face} ${styles.front}`} style={{ background: art?.gradient_bg ?? DEFAULT_GRADIENT }}>
            {art?.image_url && (
              <Image
                src={art.image_url}
                alt=""
                fill
                sizes="(max-width: 960px) 90vw, 460px"
                className={styles.frontImg}
                loading="eager"
              />
            )}
            <div className={styles.sheen} />
            <div className={styles.frontCap}>
              <span className={styles.frontCapLabel}>Artwork of the month</span>
              <span className={styles.frontCapText}>{caption}</span>
            </div>
          </div>

          {/* Back */}
          <div className={`${styles.face} ${styles.back}`}>
            <div className={styles.backLeft}>
              <div className={styles.backLabel}>Highlights from the trip</div>
              {LINES_A.map((w, i) => <span key={i} className={styles.scribble} style={{ width: w }} />)}
              <div className={`${styles.backLabel} ${styles.backLabelGap}`}>A story from the journey</div>
              {LINES_B.map((w, i) => <span key={i} className={styles.scribble} style={{ width: w }} />)}
            </div>
            <div className={styles.backRight}>
              <div className={styles.stamp}><span>Post</span></div>
              <div className={styles.addrLines}>
                <span className={styles.addrLine} />
                <span className={styles.addrLine} />
                <span className={styles.addrLine} style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.flipBtn}
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
      >
        {flipped ? '↺ See the front' : '↻ Turn it over'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// The route: published issues so far, then "next stops" still to come.
// ─────────────────────────────────────────────────────────────────
function Route({ issues }: { issues: PublicIssue[] }) {
  const ghosts = Math.max(1, 4 - issues.length);
  const last = issues.length > 0 ? issues[issues.length - 1] : null;

  const ghostLabel = (k: number) =>
    last
      ? formatMonth(`${addMonths(last.issue_month, k + 1)}-01`)
      : `Month 0${k + 1}`;

  return (
    <ol className={styles.route}>
      {issues.map((i) => (
        <li key={i.id} className={styles.stop}>
          <div className={styles.miniCard} style={{ background: i.artwork?.gradient_bg ?? DEFAULT_GRADIENT }}>
            {i.artwork?.image_url && (
              <Image src={i.artwork.image_url} alt={i.artwork.title} fill sizes="220px" className={styles.miniImg} />
            )}
          </div>
          <div className={styles.stopMonth}>{formatMonth(i.issue_month)}</div>
          <div className={styles.stopCity}>{i.city}</div>
          {i.country && <div className={styles.stopNote}>{i.country}</div>}
        </li>
      ))}

      {Array.from({ length: ghosts }).map((_, k) => (
        <li key={`next-${k}`} className={`${styles.stop} ${styles.stopNext}`}>
          <div className={`${styles.miniCard} ${styles.miniGhost}`} aria-hidden="true"><span>?</span></div>
          <div className={styles.stopMonth}>{ghostLabel(k)}</div>
          <div className={styles.stopCity}>{k === 0 ? 'Next stop' : 'Still to come'}</div>
          <div className={styles.stopNote}>Revealed in the post</div>
        </li>
      ))}
    </ol>
  );
}

// Sign-up link. Opens the Google Form in a new tab.
function JoinLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <a className={className} href={POSTCARD_FORM_URL} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function PostcardsPage({ issues }: Props) {
  const latest = issues.length > 0 ? issues[issues.length - 1] : null;

  return (
    <div className="min-h-dvh bg-[#f4f1ea] text-[#1c1a17]">
      {/* Header — same pattern as /browse */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#f4f1ea]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10">
          <Link href="/" className="font-serif text-2xl tracking-wide">
            Yu Jun Jie
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/about"
              className="whitespace-nowrap rounded-full border border-black/15 px-4 py-2 text-sm transition hover:bg-black/[0.04] sm:text-base"
            >
              About
            </Link>
            <Link
              href="/browse"
              className="whitespace-nowrap rounded-full border border-black/15 px-4 py-2 text-sm transition hover:bg-black/[0.04] sm:text-base"
            >
              Browse
            </Link>
            <Link
              href="/"
              className="whitespace-nowrap rounded-full bg-[#8b6842] px-4 py-2 text-sm text-white transition hover:opacity-90 sm:text-base"
            >
              3D gallery →
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroLeft}>
              <div className={styles.eyebrow}>Monthly snail mail</div>
              <h1 className={styles.heroHeading}>
                A postcard from <em>every city</em> I&rsquo;ve travelled to.
              </h1>
              <p className={styles.heroSub}>
                Once a month, an original print of my artwork lands in your mailbox, with a few
                highlights from the trip and a personal story.
              </p>
              <div className={styles.heroCtas}>
                <JoinLink className={styles.btnPrimary}>Add your address →</JoinLink>
                <a href="#how" className={styles.btnSecondary}>How it works</a>
              </div>
              <p className={styles.heroNote}>A short form. Opens in a new tab.</p>
            </div>

            <PostcardVisual issue={latest} />
          </div>
        </section>

        {/* ── How it works ── */}
        <section className={styles.how} id="how">
          <div className={styles.inner}>
            <div className={styles.howGrid}>
              <div>
                <div className={styles.sectionLabel}>How it works</div>
                <p className={styles.para}>
                  At the start of every month, I&rsquo;ll post you a postcard featuring an original print
                  of my artwork of the month. Each one is based on a city I&rsquo;ve travelled to, and comes
                  with a few highlights from my time there and a personal story from the trip.
                </p>
                <p className={styles.para}>
                  Every design continues from the one before it, so month by month you&rsquo;ll follow the
                  journey and get to imagine the places, and the stories, still ahead.
                </p>
              </div>

              <div>
                <div className={styles.sectionLabel}>In every postcard</div>
                <div className={styles.factList}>
                  {[
                    ['Arrives', 'Start of every month'],
                    ['The front', 'Original print of my artwork'],
                    ['The back', 'Trip highlights and a story'],
                    ['Each month', 'A city I’ve travelled to'],
                    ['The thread', 'Every design continues the last'],
                  ].map(([k, v]) => (
                    <div key={k} className={styles.fact}>
                      <span className={styles.factKey}>{k}</span>
                      <span className={styles.factVal}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What to look forward to: the route ── */}
        <section className={styles.journey}>
          <div className={styles.inner}>
            <div className={styles.sectionLabel}>What to look forward to</div>
            <h2 className={styles.journeyHeading}>
              One city a month. <em>One journey</em> that keeps going.
            </h2>
            <p className={styles.journeySub}>
              {issues.length > 0
                ? 'Here is the route so far. Join in and the next stop lands in your mailbox.'
                : 'The route is still being drawn. Join now and you will be there from the very first postcard.'}
            </p>

            <Route issues={issues} />

            <div className={styles.journeyCta}>
              <JoinLink className={styles.btnGold}>Join the journey →</JoinLink>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className={styles.cta}>
          <div className={styles.inner}>
            <div className={styles.ctaBox}>
              <div>
                <h3 className={styles.ctaHeading}>Follow the journey from the first postcard.</h3>
                <p className={styles.ctaBody}>
                  Add your address and your postcards will be on their way to you soon.
                </p>
                <ol className={styles.miniSteps}>
                  <li>Add your address</li>
                  <li>Wait for the start of the month</li>
                  <li>Open your mailbox</li>
                </ol>
              </div>
              <div className={styles.ctaButtons}>
                <JoinLink className={styles.btnPrimary}>Add your address →</JoinLink>
                <a className={styles.btnGhost} href={emailUrl}>
                  Questions? Get in touch
                </a>
                <Link href="/" className={styles.btnGhost}>See the paintings</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
