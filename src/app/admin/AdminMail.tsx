'use client';

// Snail mail tab — monthly issues, subscribers and the shipments that connect them.
// All data comes from /api/admin/mail/* (admin login required). After every change the
// parent reloads the data, so what you see is always what is stored.

import { useMemo, useState } from 'react';
import type { Artwork } from '@/types/artwork';
import {
  type MailData, type MailIssue, type MailShipment, type MailSubscriber,
  type IssueStatus, type ShipmentStatus, type SubscriberStatus,
  ISSUE_STATUSES, SHIPMENT_STATUSES, SUBSCRIBER_STATUSES,
  addMonths, addressLines, formatMonth, money, shipmentMoney, todaySG,
} from '@/lib/mail';
import { adminApi } from '@/lib/admin-fetch';
import styles from './AdminMail.module.css';

interface Props {
  data: MailData | null;
  artworks: Artwork[];
  loading: boolean;
  error: string;
  onChanged: () => Promise<void> | void;
}

type View   = 'issues' | 'subscribers';
type Notice = { kind: 'ok' | 'err'; text: string } | null;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (s: string) => (s.trim() === '' ? 0 : Number(s));

// ─────────────────────────────────────────────────────────────────
// Issue form
// ─────────────────────────────────────────────────────────────────
type IssueForm = {
  issue_month: string;   // 'YYYY-MM'
  city: string;
  country: string;
  title: string;
  artwork_id: string;
  status: IssueStatus;
  is_published: boolean;
  print_cost: string;
  postage_local: string;
  postage_intl: string;
  packaging_cost: string;
  highlights: string;
  story: string;
  notes: string;
};

function issueToForm(i: MailIssue): IssueForm {
  return {
    issue_month: i.issue_month.slice(0, 7),
    city: i.city,
    country: i.country ?? '',
    title: i.title ?? '',
    artwork_id: i.artwork_id ?? '',
    status: i.status,
    is_published: i.is_published,
    print_cost: String(i.print_cost),
    postage_local: String(i.postage_local),
    postage_intl: String(i.postage_intl),
    packaging_cost: String(i.packaging_cost),
    highlights: i.highlights ?? '',
    story: i.story ?? '',
    notes: i.notes ?? '',
  };
}

// A new issue defaults to the month after the latest one, and copies the costs of the
// most recent issue that has any costs filled in (so one blank issue doesn't reset them).
function blankIssue(issues: MailIssue[]): IssueForm {
  const newestFirst = [...issues].sort((a, b) => b.issue_month.localeCompare(a.issue_month));
  const latest = newestFirst[0];
  const costed = newestFirst.find(
    (i) => Number(i.print_cost) + Number(i.postage_local) + Number(i.postage_intl) + Number(i.packaging_cost) > 0
  );
  const thisMonth = todaySG().slice(0, 7);
  const month = latest && latest.issue_month.slice(0, 7) >= thisMonth
    ? addMonths(latest.issue_month, 1)
    : thisMonth;
  return {
    issue_month: month,
    city: '', country: '', title: '', artwork_id: '',
    status: 'planning', is_published: false,
    print_cost: costed ? String(costed.print_cost) : '0',
    postage_local: costed ? String(costed.postage_local) : '0',
    postage_intl: costed ? String(costed.postage_intl) : '0',
    packaging_cost: costed ? String(costed.packaging_cost) : '0',
    highlights: '', story: '', notes: '',
  };
}

// ─────────────────────────────────────────────────────────────────
// Subscriber form
// ─────────────────────────────────────────────────────────────────
type SubForm = {
  name: string; email: string; phone: string;
  address_line1: string; address_line2: string; city: string; state_region: string;
  postal_code: string; country: string;
  status: SubscriberStatus; price_per_issue: string;
  source: string; notes: string; joined_on: string;
};

const blankSub = (): SubForm => ({
  name: '', email: '', phone: '',
  address_line1: '', address_line2: '', city: '', state_region: '',
  postal_code: '', country: 'Singapore',
  status: 'active', price_per_issue: '0',
  source: '', notes: '', joined_on: todaySG(),
});

function subToForm(s: MailSubscriber): SubForm {
  return {
    name: s.name, email: s.email ?? '', phone: s.phone ?? '',
    address_line1: s.address_line1, address_line2: s.address_line2 ?? '',
    city: s.city ?? '', state_region: s.state_region ?? '',
    postal_code: s.postal_code ?? '', country: s.country,
    status: s.status, price_per_issue: String(s.price_per_issue),
    source: s.source ?? '', notes: s.notes ?? '', joined_on: s.joined_on,
  };
}

// ─────────────────────────────────────────────────────────────────
export default function AdminMail({ data, artworks, loading, error, onChanged }: Props) {
  const [view, setView] = useState<View>('issues');
  const [notice, setNotice] = useState<Notice>(null);

  const say = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    if (kind === 'ok') setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), 4000);
  };

  if (loading) return <div className={styles.state}>Loading…</div>;

  if (!data) {
    return (
      <div className={styles.state}>
        <p className={styles.errText}>{error || 'Snail mail data could not be loaded.'}</p>
        <button className={styles.btn} onClick={() => onChanged()}>Try again</button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.subnav}>
        <button className={`${styles.subTab} ${view === 'issues' ? styles.subTabOn : ''}`} onClick={() => { setView('issues'); setNotice(null); }}>
          Monthly issues <span className={styles.count}>{data.issues.length}</span>
        </button>
        <button className={`${styles.subTab} ${view === 'subscribers' ? styles.subTabOn : ''}`} onClick={() => { setView('subscribers'); setNotice(null); }}>
          Subscribers <span className={styles.count}>{data.subscribers.length}</span>
        </button>
      </div>

      {error && <p className={styles.errBanner} role="alert">{error}</p>}
      {notice && (
        <p className={notice.kind === 'ok' ? styles.okBanner : styles.errBanner} role={notice.kind === 'err' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      {view === 'issues'
        ? <IssuesView data={data} artworks={artworks} say={say} onChanged={onChanged} />
        : <SubscribersView data={data} say={say} onChanged={onChanged} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// ISSUES
// ═════════════════════════════════════════════════════════════════
interface ViewProps {
  data: MailData;
  say: (kind: 'ok' | 'err', text: string) => void;
  onChanged: () => Promise<void> | void;
}

function IssuesView({ data, artworks, say, onChanged }: ViewProps & { artworks: Artwork[] }) {
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<IssueForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');          // id of the shipment/action being processed

  const issues = useMemo(
    () => [...data.issues].sort((a, b) => b.issue_month.localeCompare(a.issue_month)),
    [data.issues]
  );
  const artworkById = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);
  const subById = useMemo(() => new Map(data.subscribers.map((s) => [s.id, s])), [data.subscribers]);

  const selected = selectedId && selectedId !== 'new' ? data.issues.find((i) => i.id === selectedId) ?? null : null;
  const shipments = useMemo(
    () => (selected ? data.shipments.filter((s) => s.issue_id === selected.id) : []),
    [data.shipments, selected]
  );

  const counts = (issueId: string) => {
    const list = data.shipments.filter((s) => s.issue_id === issueId);
    return { total: list.length, mailed: list.filter((s) => s.status !== 'pending' && s.status !== 'printed').length };
  };

  const pick = (i: MailIssue) => { setSelectedId(i.id); setForm(issueToForm(i)); };
  const startNew = () => { setSelectedId('new'); setForm(blankIssue(data.issues)); };
  const set = <K extends keyof IssueForm>(k: K, v: IssueForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  // ── Save issue ──
  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        issue_month: form.issue_month,
        city: form.city,
        country: form.country,
        title: form.title,
        artwork_id: form.artwork_id === '' ? null : form.artwork_id,
        status: form.status,
        is_published: form.is_published,
        print_cost: num(form.print_cost),
        postage_local: num(form.postage_local),
        postage_intl: num(form.postage_intl),
        packaging_cost: num(form.packaging_cost),
        highlights: form.highlights,
        story: form.story,
        notes: form.notes,
      };
      if (selectedId === 'new') {
        const json = await adminApi('POST', '/api/admin/mail/issues', payload);
        const created = json.issue as MailIssue;
        await onChanged();
        setSelectedId(created.id);
        say('ok', 'Issue created. Next: generate shipments for your subscribers.');
      } else if (selected) {
        await adminApi('PATCH', `/api/admin/mail/issues/${selected.id}`, payload);
        await onChanged();
        say('ok', 'Changes saved.');
      }
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeIssue = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete the ${formatMonth(selected.issue_month)} issue (${selected.city})? This cannot be undone.`)) return;
    try {
      await adminApi('DELETE', `/api/admin/mail/issues/${selected.id}`);
      setSelectedId(null);
      setForm(null);
      await onChanged();
      say('ok', 'Issue deleted.');
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  // ── Shipments ──
  const generate = async () => {
    if (!selected) return;
    setBusy('generate');
    try {
      const json = await adminApi('POST', `/api/admin/mail/issues/${selected.id}/generate`);
      await onChanged();
      const created = Number(json.created ?? 0);
      const skipped = Number(json.skipped ?? 0);
      say('ok', typeof json.message === 'string'
        ? json.message
        : `Created ${created} shipment${created === 1 ? '' : 's'}${skipped ? `, ${skipped} already existed` : ''}.`);
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not generate shipments.');
    } finally {
      setBusy('');
    }
  };

  const bulk = async (to: 'printed' | 'mailed') => {
    if (!selected) return;
    const waiting = shipments.filter((s) => (to === 'printed' ? s.status === 'pending' : s.status === 'pending' || s.status === 'printed')).length;
    if (waiting === 0) { say('err', `There is nothing to mark as ${to}.`); return; }
    if (!window.confirm(`Mark ${waiting} postcard${waiting === 1 ? '' : 's'} as ${to}?`)) return;
    setBusy(`bulk-${to}`);
    try {
      const json = await adminApi('POST', `/api/admin/mail/issues/${selected.id}/bulk`, { to });
      await onChanged();
      say('ok', `${Number(json.updated ?? 0)} marked as ${to}.`);
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy('');
    }
  };

  const setShipmentStatus = async (s: MailShipment, status: ShipmentStatus) => {
    setBusy(s.id);
    try {
      const patch: Record<string, unknown> = { status };
      if ((status === 'mailed') && !s.mailed_on) patch.mailed_on = todaySG();
      if (status === 'pending' || status === 'printed') patch.mailed_on = null;
      await adminApi('PATCH', `/api/admin/mail/shipments/${s.id}`, patch);
      await onChanged();
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy('');
    }
  };

  const setTracking = async (s: MailShipment, value: string) => {
    if (value.trim() === (s.tracking_ref ?? '')) return;
    setBusy(s.id);
    try {
      await adminApi('PATCH', `/api/admin/mail/shipments/${s.id}`, { tracking_ref: value });
      await onChanged();
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy('');
    }
  };

  const removeShipment = async (s: MailShipment) => {
    const name = subById.get(s.subscriber_id)?.name ?? 'this subscriber';
    if (!window.confirm(`Remove ${name} from this issue?`)) return;
    setBusy(s.id);
    try {
      await adminApi('DELETE', `/api/admin/mail/shipments/${s.id}`);
      await onChanged();
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setBusy('');
    }
  };

  const copyList = async () => {
    const todo = shipments.filter((s) => s.status === 'pending' || s.status === 'printed');
    const blocks = todo
      .map((s) => subById.get(s.subscriber_id))
      .filter((s): s is MailSubscriber => Boolean(s))
      .map((s) => addressLines(s).join('\n'));
    if (blocks.length === 0) { say('err', 'No addresses to copy: everything is already mailed.'); return; }
    try {
      await navigator.clipboard.writeText(blocks.join('\n\n'));
      say('ok', `Copied ${blocks.length} address${blocks.length === 1 ? '' : 'es'}.`);
    } catch {
      say('err', 'Could not copy. Your browser blocked clipboard access.');
    }
  };

  // ── Per-issue numbers ──
  const money_ = shipments.reduce(
    (acc, s) => { const m = shipmentMoney(s); acc.revenue += m.revenue; acc.cost += m.cost; return acc; },
    { revenue: 0, cost: 0 }
  );
  const statusCount = (st: ShipmentStatus) => shipments.filter((s) => s.status === st).length;
  const linkedArtwork = form?.artwork_id ? artworkById.get(form.artwork_id) : undefined;

  return (
    <div className={styles.split}>
      {/* ── List ── */}
      <aside className={styles.list}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Issues</span>
          <button className={styles.btnPrimarySm} onClick={startNew}>+ New</button>
        </div>
        {issues.length === 0 && <p className={styles.empty}>No issues yet. Create the first one.</p>}
        {issues.map((i) => {
          const c = counts(i.id);
          return (
            <button key={i.id}
              className={`${styles.row} ${selectedId === i.id ? styles.rowOn : ''}`}
              onClick={() => pick(i)}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{formatMonth(i.issue_month, 'short')} · {i.city}</span>
                <span className={styles.rowMeta}>
                  {i.status}{i.is_published ? ' · public' : ''}{c.total ? ` · ${c.mailed}/${c.total} mailed` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      {/* ── Detail ── */}
      <section className={styles.detail}>
        {!form ? (
          <div className={styles.placeholder}>
            <p>Select an issue, or create the next monthly postcard.</p>
            <button className={styles.btnPrimary} onClick={startNew}>+ New issue</button>
          </div>
        ) : (
          <>
            <div className={styles.detailHead}>
              <h2 className={styles.detailTitle}>
                {selectedId === 'new' ? 'New issue' : `${form.city || 'Untitled'} · ${form.issue_month ? formatMonth(`${form.issue_month}-01`) : ''}`}
              </h2>
              <div className={styles.headActions}>
                {selected && <button className={styles.btnDanger} onClick={removeIssue}>Delete</button>}
                <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : selectedId === 'new' ? 'Create issue' : 'Save changes'}
                </button>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>The postcard</div>
              <div className={styles.grid3}>
                <label className={styles.field}>Month *
                  <input type="month" value={form.issue_month} onChange={(e) => set('issue_month', e.target.value)} />
                </label>
                <label className={styles.field}>City *
                  <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Lisbon" />
                </label>
                <label className={styles.field}>Country
                  <input type="text" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Portugal" />
                </label>
              </div>
              <div className={styles.grid3}>
                <label className={styles.field}>Design title
                  <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} />
                </label>
                <label className={styles.field}>Artwork of the month
                  <select value={form.artwork_id} onChange={(e) => set('artwork_id', e.target.value)}>
                    <option value="">— Not linked —</option>
                    {artworks.map((a) => (
                      <option key={a.id} value={a.id}>{a.title} ({a.status})</option>
                    ))}
                  </select>
                  {linkedArtwork && (
                    <span className={`${styles.hint} ${linkedArtwork.status === 'in-progress' ? styles.hintWarn : ''}`}>
                      {linkedArtwork.status === 'in-progress'
                        ? 'This artwork is still in progress.'
                        : `Artwork is ${linkedArtwork.status}.`}
                    </span>
                  )}
                </label>
                <label className={styles.field}>Postcard status
                  <select value={form.status} onChange={(e) => set('status', e.target.value as IssueStatus)}>
                    {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                </label>
              </div>
              <label className={styles.check}>
                <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                <span>Show this issue on the public Postcards page <em>(city, month and artwork only)</em></span>
              </label>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>What goes on the card</div>
              <label className={styles.field}>Highlights from the trip
                <textarea rows={3} value={form.highlights} onChange={(e) => set('highlights', e.target.value)} />
              </label>
              <label className={styles.field}>Personal story
                <textarea rows={4} value={form.story} onChange={(e) => set('story', e.target.value)} />
              </label>
              <span className={styles.hint}>Private. These never appear on the public site.</span>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Cost per postcard</div>
              <div className={styles.grid4}>
                <label className={styles.field}>Print (S$)
                  <input type="number" min="0" step="0.01" value={form.print_cost} onChange={(e) => set('print_cost', e.target.value)} />
                </label>
                <label className={styles.field}>Postage, Singapore (S$)
                  <input type="number" min="0" step="0.01" value={form.postage_local} onChange={(e) => set('postage_local', e.target.value)} />
                </label>
                <label className={styles.field}>Postage, overseas (S$)
                  <input type="number" min="0" step="0.01" value={form.postage_intl} onChange={(e) => set('postage_intl', e.target.value)} />
                </label>
                <label className={styles.field}>Packaging (S$)
                  <input type="number" min="0" step="0.01" value={form.packaging_cost} onChange={(e) => set('packaging_cost', e.target.value)} />
                </label>
              </div>
              <span className={styles.hint}>
                Copied onto each shipment when you generate them. Changing these later does not alter shipments that already exist.
              </span>
              <label className={styles.field}>Notes
                <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>

            {/* ── Shipments (only once the issue exists) ── */}
            {selected && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Shipments</div>

                <div className={styles.statsRow}>
                  <span>{shipments.length} total</span>
                  {SHIPMENT_STATUSES.map((st) => <span key={st}>{statusCount(st)} {st}</span>)}
                  <span className={styles.statsMoney}>
                    {money(money_.revenue)} in · {money(money_.cost)} out ·{' '}
                    <strong className={money_.revenue - money_.cost < 0 ? styles.neg : ''}>{money(money_.revenue - money_.cost)}</strong>
                  </span>
                </div>

                <div className={styles.toolbar}>
                  <button className={styles.btn} onClick={generate} disabled={busy !== ''}>
                    {busy === 'generate' ? 'Working…' : 'Generate shipments for active subscribers'}
                  </button>
                  <button className={styles.btn} onClick={() => bulk('printed')} disabled={busy !== ''}>Mark all printed</button>
                  <button className={styles.btn} onClick={() => bulk('mailed')} disabled={busy !== ''}>Mark all mailed</button>
                  <button className={styles.btn} onClick={copyList}>Copy addresses to mail</button>
                </div>

                {shipments.length === 0 ? (
                  <p className={styles.empty}>No shipments yet. Add subscribers, then generate shipments.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Subscriber</th><th>Address</th><th>Status</th><th>Tracking</th><th>Profit</th><th /></tr>
                      </thead>
                      <tbody>
                        {shipments.map((s) => {
                          const sub = subById.get(s.subscriber_id);
                          const unit = Number(s.price_charged) - (Number(s.print_cost) + Number(s.postage_cost) + Number(s.packaging_cost));
                          return (
                            <tr key={s.id} className={busy === s.id ? styles.dim : ''}>
                              <td>{sub?.name ?? 'Unknown'}{sub && sub.status !== 'active' && <span className={styles.tag}>{sub.status}</span>}</td>
                              <td className={styles.addr}>{sub ? addressLines(sub).slice(1).join(', ') : ''}</td>
                              <td>
                                <select value={s.status} disabled={busy === s.id}
                                  onChange={(e) => setShipmentStatus(s, e.target.value as ShipmentStatus)}>
                                  {SHIPMENT_STATUSES.map((st) => <option key={st} value={st}>{cap(st)}</option>)}
                                </select>
                                {s.mailed_on && <span className={styles.hint}>{s.mailed_on}</span>}
                              </td>
                              <td>
                                <input type="text" defaultValue={s.tracking_ref ?? ''} placeholder="—" maxLength={120}
                                  aria-label="Tracking reference"
                                  key={`${s.id}-${s.tracking_ref ?? ''}`}
                                  onBlur={(e) => setTracking(s, e.target.value)} />
                              </td>
                              <td className={unit < 0 ? styles.neg : ''}>{money(unit)}</td>
                              <td><button className={styles.x} onClick={() => removeShipment(s)} aria-label="Remove shipment" title="Remove from this issue">×</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// SUBSCRIBERS
// ═════════════════════════════════════════════════════════════════
function SubscribersView({ data, say, onChanged }: ViewProps) {
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<SubForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | SubscriberStatus>('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.subscribers.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return [s.name, s.email ?? '', s.country, s.city ?? '', s.postal_code ?? '']
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [data.subscribers, filter, query]);

  const selected = selectedId && selectedId !== 'new' ? data.subscribers.find((s) => s.id === selectedId) ?? null : null;

  const pick = (s: MailSubscriber) => { setSelectedId(s.id); setForm(subToForm(s)); };
  const startNew = () => { setSelectedId('new'); setForm(blankSub()); };
  const set = <K extends keyof SubForm>(k: K, v: SubForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, email: form.email, phone: form.phone,
        address_line1: form.address_line1, address_line2: form.address_line2,
        city: form.city, state_region: form.state_region,
        postal_code: form.postal_code, country: form.country,
        status: form.status, price_per_issue: num(form.price_per_issue),
        source: form.source, notes: form.notes,
        ...(form.joined_on ? { joined_on: form.joined_on } : {}),
      };
      if (selectedId === 'new') {
        const json = await adminApi('POST', '/api/admin/mail/subscribers', payload);
        const created = json.subscriber as MailSubscriber;
        await onChanged();
        setSelectedId(created.id);
        say('ok', 'Subscriber added. They are included the next time you generate shipments for an issue.');
      } else if (selected) {
        await adminApi('PATCH', `/api/admin/mail/subscribers/${selected.id}`, payload);
        await onChanged();
        say('ok', 'Changes saved.');
      }
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    try {
      await adminApi('DELETE', `/api/admin/mail/subscribers/${selected.id}`);
      setSelectedId(null);
      setForm(null);
      await onChanged();
      say('ok', 'Subscriber deleted.');
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  return (
    <div className={styles.split}>
      <aside className={styles.list}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Subscribers</span>
          <button className={styles.btnPrimarySm} onClick={startNew}>+ Add</button>
        </div>
        <div className={styles.filters}>
          <input type="search" placeholder="Search name, email, country…" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search subscribers" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | SubscriberStatus)} aria-label="Filter by status">
            <option value="all">All</option>
            {SUBSCRIBER_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
        {data.subscribers.length === 0 && <p className={styles.empty}>No subscribers yet. Add people from your Google Form responses.</p>}
        {data.subscribers.length > 0 && shown.length === 0 && <p className={styles.empty}>No matches.</p>}
        {shown.map((s) => (
          <button key={s.id}
            className={`${styles.row} ${selectedId === s.id ? styles.rowOn : ''}`}
            onClick={() => pick(s)}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{s.name}</span>
              <span className={styles.rowMeta}>{s.city ? `${s.city}, ` : ''}{s.country} · {s.status}</span>
            </span>
          </button>
        ))}
      </aside>

      <section className={styles.detail}>
        {!form ? (
          <div className={styles.placeholder}>
            <p>Select a subscriber, or add someone from a new form response.</p>
            <button className={styles.btnPrimary} onClick={startNew}>+ Add subscriber</button>
          </div>
        ) : (
          <>
            <div className={styles.detailHead}>
              <h2 className={styles.detailTitle}>{selectedId === 'new' ? 'New subscriber' : form.name || 'Subscriber'}</h2>
              <div className={styles.headActions}>
                {selected && <button className={styles.btnDanger} onClick={remove}>Delete</button>}
                <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : selectedId === 'new' ? 'Add subscriber' : 'Save changes'}
                </button>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Who</div>
              <div className={styles.grid3}>
                <label className={styles.field}>Name *
                  <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
                </label>
                <label className={styles.field}>Email
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
                </label>
                <label className={styles.field}>Phone
                  <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
                </label>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Where to send it</div>
              <div className={styles.grid2}>
                <label className={styles.field}>Address line 1 *
                  <input type="text" value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} autoComplete="off" />
                </label>
                <label className={styles.field}>Address line 2
                  <input type="text" value={form.address_line2} onChange={(e) => set('address_line2', e.target.value)} autoComplete="off" />
                </label>
              </div>
              <div className={styles.grid4}>
                <label className={styles.field}>City
                  <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="off" />
                </label>
                <label className={styles.field}>State / region
                  <input type="text" value={form.state_region} onChange={(e) => set('state_region', e.target.value)} autoComplete="off" />
                </label>
                <label className={styles.field}>Postal code
                  <input type="text" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} autoComplete="off" />
                </label>
                <label className={styles.field}>Country *
                  <input type="text" value={form.country} onChange={(e) => set('country', e.target.value)} autoComplete="off" />
                </label>
              </div>
              <span className={styles.hint}>
                “Singapore” uses your local postage cost; any other country uses the overseas cost.
              </span>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Subscription</div>
              <div className={styles.grid4}>
                <label className={styles.field}>Status
                  <select value={form.status} onChange={(e) => set('status', e.target.value as SubscriberStatus)}>
                    {SUBSCRIBER_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                </label>
                <label className={styles.field}>Price per issue (S$)
                  <input type="number" min="0" step="0.01" value={form.price_per_issue} onChange={(e) => set('price_per_issue', e.target.value)} />
                </label>
                <label className={styles.field}>Joined
                  <input type="date" value={form.joined_on} onChange={(e) => set('joined_on', e.target.value)} />
                </label>
                <label className={styles.field}>How they found you
                  <input type="text" value={form.source} onChange={(e) => set('source', e.target.value)} autoComplete="off" />
                </label>
              </div>
              <span className={styles.hint}>Only Active subscribers get a postcard when you generate shipments. Use 0 for free.</span>
              <label className={styles.field}>Notes
                <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
