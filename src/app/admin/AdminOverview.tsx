'use client';

// Overview tab — the artwork pipeline and the postcard pipeline in one view,
// so it is obvious when a monthly postcard depends on a painting that is not finished.

import { useMemo } from 'react';
import type { Artwork } from '@/types/artwork';
import {
  type MailData, type MailIssue,
  addMonths, formatMonth, money, shipmentMoney, todaySG,
} from '@/lib/mail';
import styles from './AdminOverview.module.css';

interface Props {
  artworks: Artwork[];
  mail: MailData | null;
  error: string;
  loading: boolean;
  onOpenMail: () => void;
  onOpenArtworks: () => void;
}

const ARTWORK_STATUS_LABEL: Record<string, string> = {
  'available': 'Available',
  'in-progress': 'In progress',
  'sold': 'Sold',
};

type Alert = { text: string; level: 'warn' | 'info'; go: 'mail' | 'artworks' };

export default function AdminOverview({ artworks, mail, error, loading, onOpenMail, onOpenArtworks }: Props) {
  const view = useMemo(() => {
    if (!mail) return null;

    const thisMonth = todaySG().slice(0, 7);          // 'YYYY-MM'
    const byId = new Map(artworks.map((a) => [a.id, a]));
    const activeSubs = mail.subscribers.filter((s) => s.status === 'active').length;

    // shipments grouped per issue
    const perIssue = new Map<string, { total: number; toMail: number; mailed: number }>();
    for (const s of mail.shipments) {
      const c = perIssue.get(s.issue_id) ?? { total: 0, toMail: 0, mailed: 0 };
      c.total += 1;
      if (s.status === 'pending' || s.status === 'printed') c.toMail += 1;
      else c.mailed += 1;
      perIssue.set(s.issue_id, c);
    }

    let revenue = 0;
    let cost = 0;
    for (const s of mail.shipments) {
      const m = shipmentMoney(s);
      revenue += m.revenue;
      cost += m.cost;
    }

    const issuesAsc = [...mail.issues].sort((a, b) => a.issue_month.localeCompare(b.issue_month));
    const current = issuesAsc.find((i) => i.issue_month.slice(0, 7) === thisMonth) ?? null;
    const upcoming = issuesAsc.filter((i) => i.issue_month.slice(0, 7) >= thisMonth).slice(0, 6);

    // ── What needs attention ──
    const alerts: Alert[] = [];
    if (!current) {
      alerts.push({ level: 'warn', go: 'mail', text: `No postcard issue is planned for ${formatMonth(`${thisMonth}-01`)}.` });
    }
    for (const i of issuesAsc) {
      const month = i.issue_month.slice(0, 7);
      const counts = perIssue.get(i.id);
      const isPastOrNow = month <= thisMonth;
      const label = `${i.city} (${formatMonth(i.issue_month, 'short')})`;

      if (isPastOrNow && i.status !== 'shipped') {
        if (!counts && activeSubs > 0) {
          alerts.push({ level: 'warn', go: 'mail', text: `${label}: shipments have not been generated yet.` });
        } else if (counts && counts.toMail > 0) {
          alerts.push({ level: 'warn', go: 'mail', text: `${label}: ${counts.toMail} postcard${counts.toMail === 1 ? '' : 's'} still to mail.` });
        }
      }
      if (month >= thisMonth && i.status !== 'shipped') {
        const art = i.artwork_id ? byId.get(i.artwork_id) : null;
        if (!i.artwork_id) {
          alerts.push({ level: 'info', go: 'mail', text: `${label}: no artwork linked yet.` });
        } else if (art && art.status === 'in-progress') {
          alerts.push({ level: 'warn', go: 'artworks', text: `${label}: the linked artwork “${art.title}” is still in progress.` });
        }
      }
    }

    return { thisMonth, byId, activeSubs, perIssue, revenue, cost, current, upcoming, alerts };
  }, [mail, artworks]);

  const artCounts = {
    total: artworks.length,
    available: artworks.filter((a) => a.status === 'available').length,
    inProgress: artworks.filter((a) => a.status === 'in-progress').length,
    sold: artworks.filter((a) => a.status === 'sold').length,
  };

  if (loading) {
    return <div className={styles.state}>Loading…</div>;
  }

  const currentCounts = view?.current ? view.perIssue.get(view.current.id) : undefined;
  const subsPaused = mail ? mail.subscribers.filter((s) => s.status === 'paused').length : 0;
  const subsCancelled = mail ? mail.subscribers.filter((s) => s.status === 'cancelled').length : 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Overview</h1>

      {error && (
        <div className={styles.banner} role="alert">
          <strong>Snail mail data could not be loaded.</strong> {error}
        </div>
      )}

      {/* ── Headline numbers ── */}
      <div className={styles.cards}>
        <button className={styles.card} onClick={onOpenArtworks}>
          <span className={styles.cardLabel}>Artworks</span>
          <span className={styles.cardValue}>{artCounts.total}</span>
          <span className={styles.cardSub}>
            {artCounts.available} available · {artCounts.inProgress} in progress · {artCounts.sold} sold
          </span>
        </button>

        <button className={styles.card} onClick={onOpenMail}>
          <span className={styles.cardLabel}>Active subscribers</span>
          <span className={styles.cardValue}>{view ? view.activeSubs : '–'}</span>
          <span className={styles.cardSub}>{subsPaused} paused · {subsCancelled} cancelled</span>
        </button>

        <button className={styles.card} onClick={onOpenMail}>
          <span className={styles.cardLabel}>This month’s postcard</span>
          <span className={styles.cardValue}>{view?.current ? view.current.city : '—'}</span>
          <span className={styles.cardSub}>
            {view?.current
              ? currentCounts
                ? `${currentCounts.mailed} of ${currentCounts.total} mailed`
                : 'No shipments generated yet'
              : 'Nothing planned yet'}
          </span>
        </button>

        <button className={styles.card} onClick={onOpenMail}>
          <span className={styles.cardLabel}>Postcard profit to date</span>
          <span className={`${styles.cardValue} ${view && view.revenue - view.cost < 0 ? styles.neg : ''}`}>
            {view ? money(view.revenue - view.cost) : '–'}
          </span>
          <span className={styles.cardSub}>
            {view ? `${money(view.revenue)} in · ${money(view.cost)} out` : ''}
          </span>
        </button>
      </div>

      <div className={styles.columns}>
        {/* ── Needs attention ── */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Needs attention</h2>
          {!view ? (
            <p className={styles.muted}>Snail mail data is not available.</p>
          ) : view.alerts.length === 0 ? (
            <p className={styles.muted}>All clear. Nothing is waiting on you.</p>
          ) : (
            <ul className={styles.alerts}>
              {view.alerts.map((a, i) => (
                <li key={i} className={`${styles.alert} ${a.level === 'warn' ? styles.alertWarn : ''}`}>
                  <span>{a.text}</span>
                  <button className={styles.link} onClick={a.go === 'mail' ? onOpenMail : onOpenArtworks}>
                    {a.go === 'mail' ? 'Open snail mail →' : 'Open artworks →'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Upcoming postcards and the artwork behind each ── */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Postcards and the artwork behind them</h2>
          {!view || view.upcoming.length === 0 ? (
            <p className={styles.muted}>No current or upcoming issues. Create one in Snail mail.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Month</th><th>City</th><th>Artwork</th><th>Postcard</th><th>Mailed</th></tr>
                </thead>
                <tbody>
                  {view.upcoming.map((i: MailIssue) => {
                    const art = i.artwork_id ? view.byId.get(i.artwork_id) : undefined;
                    const c = view.perIssue.get(i.id);
                    return (
                      <tr key={i.id}>
                        <td>{formatMonth(i.issue_month, 'short')}</td>
                        <td>{i.city}</td>
                        <td>
                          {art ? (
                            <>
                              {art.title}{' '}
                              <span className={`${styles.badge} ${art.status === 'in-progress' ? styles.badgeWarn : ''}`}>
                                {ARTWORK_STATUS_LABEL[art.status] ?? art.status}
                              </span>
                            </>
                          ) : (
                            <span className={styles.muted}>Not linked</span>
                          )}
                        </td>
                        <td><span className={styles.badge}>{i.status}</span></td>
                        <td>{c ? `${c.mailed}/${c.total}` : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ── Artworks still being painted ── */}
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>In the studio</h2>
        {artworks.filter((a) => a.status === 'in-progress').length === 0 ? (
          <p className={styles.muted}>No artworks are marked as in progress.</p>
        ) : (
          <ul className={styles.studioList}>
            {artworks.filter((a) => a.status === 'in-progress').map((a) => {
              const linked = mail?.issues.find((i) => i.artwork_id === a.id);
              return (
                <li key={a.id} className={styles.studioRow}>
                  <span>{a.title}</span>
                  <span className={styles.muted}>
                    {linked
                      ? `Postcard for ${linked.city}, ${formatMonth(linked.issue_month, 'short')}`
                      : 'Not linked to a postcard'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {view && (
        <p className={styles.footnote}>
          Dates use Singapore time. “Profit to date” counts revenue for postcards that are mailed or delivered,
          and costs for postcards that have been mailed, delivered or returned. Next planned month:{' '}
          {formatMonth(`${addMonths(view.thisMonth, 1)}-01`)}.
        </p>
      )}
    </div>
  );
}
