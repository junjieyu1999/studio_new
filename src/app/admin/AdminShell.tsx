"use client";

// The /admin screen. HTTP Basic Auth (src/proxy.ts) already protects it, so
// there is no sign-in UI here. Three sections:
//   Overview    — artwork pipeline + postcard pipeline side by side
//   Artworks    — the artwork manager (unchanged)
//   Snail mail  — monthly issues, subscribers and shipments

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Artwork } from "@/types/artwork";
import type { MailData } from "@/lib/mail";
import { adminApi } from "@/lib/admin-fetch";
import ArtworksAdmin from "./ArtworksAdmin";
import AdminOverview from "./AdminOverview";
import AdminMail from "./AdminMail";
import styles from "./AdminShell.module.css";

type Tab = "overview" | "artworks" | "mail";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "artworks", label: "Artworks" },
  { id: "mail", label: "Snail mail" },
];

export default function AdminShell() {
  const [tab, setTab] = useState<Tab>("overview");

  // Shared data for Overview and Snail mail.
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [mail, setMail] = useState<MailData | null>(null);
  const [mailError, setMailError] = useState("");

  const fetchMail = useCallback(
    async () => (await adminApi("GET", "/api/admin/mail/data")) as unknown as MailData,
    []
  );

  // Used by Snail mail after every change. It resolves only once the fresh data
  // is in place, because callers such as "create issue" select the new row next.
  const reload = useCallback(async () => {
    try {
      setMail(await fetchMail());
      setMailError("");
    } catch (e) {
      setMailError(e instanceof Error ? e.message : "Could not load snail mail data.");
    }
  }, [fetchMail]);

  // Refresh whenever the admin lands on a tab that shows this data, so changes
  // made in the Artworks tab are visible on Overview / Snail mail. The
  // `cancelled` flag drops a slow response that arrives after the tab changed.
  useEffect(() => {
    if (tab !== "overview" && tab !== "mail") return;
    let cancelled = false;

    fetchMail()
      .then((data) => {
        if (cancelled) return;
        setMail(data);
        setMailError("");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setMailError(e instanceof Error ? e.message : "Could not load snail mail data.");
      });

    fetch("/api/artworks", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setArtworks(Array.isArray(json) ? json : []);
      })
      .catch(() => {
        /* the Overview simply shows no artworks */
      });

    return () => {
      cancelled = true;
    };
  }, [tab, fetchMail]);

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barLeft}>
          <span className={styles.brand}>Studio admin</span>
          <nav className={styles.tabs} aria-label="Admin sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`}
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className={styles.barRight}>
          <Link href="/" className={styles.ghost}>
            ← Gallery
          </Link>
        </div>
      </header>

      {tab === "overview" && (
        <AdminOverview
          artworks={artworks}
          mail={mail}
          error={mailError}
          loading={!mail && !mailError}
          onOpenMail={() => setTab("mail")}
          onOpenArtworks={() => setTab("artworks")}
        />
      )}

      {/* Kept mounted (just hidden) so unsaved edits survive switching tabs. */}
      <div hidden={tab !== "artworks"}>
        <ArtworksAdmin />
      </div>

      {tab === "mail" && (
        <AdminMail
          data={mail}
          artworks={artworks}
          loading={!mail && !mailError}
          error={mailError}
          onChanged={reload}
        />
      )}
    </div>
  );
}
