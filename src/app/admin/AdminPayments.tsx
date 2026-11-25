'use client';

// Snail mail → Payments. The money side of the subscription CRM:
//   • totals (received this month / in total / by method)
//   • your price for each plan (3, 6 and 12 months)
//   • who needs to pay or renew
//   • every payment, newest first
// All figures are computed from the payments you record, in Singapore dollars.

import { useMemo, useState } from 'react';
import {
  type MailData, type PaymentMethod,
  PAYMENT_METHODS, PLAN_MONTHS, formatMonth, money,
} from '@/lib/mail';
import {
  METHOD_LABEL, currentMonthSG, payStatus, paymentsBySubscriber, planLabel, receivedTotal,
} from '@/lib/mail-payments';
import { adminApi } from '@/lib/admin-fetch';
import RecordPaymentForm from './RecordPaymentForm';
import PayBadge from './PayBadge';
import { coverageText } from './SubscriberPayments';
import styles from './AdminMail.module.css';

interface Props {
  data: MailData;
  say: (kind: 'ok' | 'err', text: string) => void;
  onChanged: () => Promise<void> | void;
  onOpenSubscriber: (id: string) => void;
}

const month = (ym: string) => formatMonth(`${ym}-01`, 'short');

export default function AdminPayments({ data, say, onChanged, onOpenSubscriber }: Props) {
  const [recordFor, setRecordFor] = useState<string | 'any' | null>(null);
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [showRefunded, setShowRefunded] = useState(false);
  const [query, setQuery] = useState('');
  const [edits, setEdits] = useState<Record<number, { price?: string; is_active?: boolean }>>({});
  const [savingPlan, setSavingPlan] = useState<number | null>(null);

  const nowYm = currentMonthSG();
  const subById = useMemo(() => new Map(data.subscribers.map((s) => [s.id, s])), [data.subscribers]);

  const view = useMemo(() => {
    const bySub = paymentsBySubscriber(data.payments);
    const rows = data.subscribers
      .filter((s) => s.status === 'active')
      .map((s) => ({ sub: s, status: payStatus(s, bySub.get(s.id) ?? [], nowYm) }));
    const attention = rows
      .filter((r) => r.status.state === 'lapsed' || r.status.state === 'unpaid' || r.status.state === 'renew')
      .sort((a, b) => a.status.nextUnpaid.localeCompare(b.status.nextUnpaid) || a.sub.name.localeCompare(b.sub.name));
    const paying = rows.filter((r) => r.status.state !== 'free').length;
    const received = data.payments.filter((p) => p.status === 'received');
    const thisMonth = received.filter((p) => p.paid_on.slice(0, 7) === nowYm);
    const byMethod = PAYMENT_METHODS.map((m) => ({
      m, total: receivedTotal(received.filter((p) => p.method === m)), n: received.filter((p) => p.method === m).length,
    })).filter((x) => x.n > 0);
    return {
      attention, paying,
      paidUp: paying - attention.filter((r) => r.status.state !== 'renew').length,
      monthTotal: receivedTotal(thisMonth), monthCount: thisMonth.length,
      total: receivedTotal(received), count: received.length,
      byMethod,
    };
  }, [data.payments, data.subscribers, nowYm]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.payments]
      .filter((p) => (showRefunded ? true : p.status === 'received'))
      .filter((p) => methodFilter === 'all' || p.method === methodFilter)
      .filter((p) => {
        if (!q) return true;
        const s = subById.get(p.subscriber_id);
        return [s?.name ?? '', s?.payment_ref ?? '', p.reference ?? ''].some((v) => v.toLowerCase().includes(q));
      })
      .sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at));
  }, [data.payments, methodFilter, showRefunded, query, subById]);

  if (data.paymentsSetupNeeded) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Payments</div>
        <p className={styles.hintWarn}>
          Payment tracking is not set up yet. In the Supabase SQL Editor, run <code>supabase/migration_payments.sql</code> (after
          <code> migration_snail_mail.sql</code>), then reload this page.
        </p>
      </div>
    );
  }

  const planDraft = (months: number) => {
    const plan = data.plans.find((p) => p.months === months);
    return {
      price: edits[months]?.price ?? (plan?.price === null || plan?.price === undefined ? '' : String(plan.price)),
      active: edits[months]?.is_active ?? plan?.is_active ?? true,
      dirty: edits[months] !== undefined,
    };
  };

  const savePlan = async (months: number) => {
    const d = planDraft(months);
    setSavingPlan(months);
    try {
      await adminApi('PATCH', `/api/admin/mail/plans/${months}`, { price: d.price.trim() === '' ? null : Number(d.price), is_active: d.active });
      await onChanged();
      setEdits((e) => { const n = { ...e }; delete n[months]; return n; });
      say('ok', `${planLabel(months)} plan saved.`);
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      setSavingPlan(null);
    }
  };

  const activeSubs = data.subscribers.filter((s) => s.status !== 'cancelled');

  return (
    <div className={styles.payPage}>
      {/* ── Totals ── */}
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Received this month</div>
          <div className={styles.tileValue}>{money(view.monthTotal)}</div>
          <div className={styles.tileSub}>{view.monthCount} payment{view.monthCount === 1 ? '' : 's'}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Received in total</div>
          <div className={styles.tileValue}>{money(view.total)}</div>
          <div className={styles.tileSub}>{view.count} payment{view.count === 1 ? '' : 's'}, refunds excluded</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Paid up</div>
          <div className={styles.tileValue}>{view.paidUp} <span className={styles.tileSub}>of {view.paying}</span></div>
          <div className={styles.tileSub}>active paying subscribers, for {month(nowYm)}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>By method</div>
          {view.byMethod.length === 0
            ? <div className={styles.tileSub}>Nothing received yet</div>
            : view.byMethod.map((x) => (
              <div key={x.m} className={styles.tileSub}>{METHOD_LABEL[x.m]}: <strong>{money(x.total)}</strong> ({x.n})</div>
            ))}
        </div>
      </div>

      {/* ── Record a payment ── */}
      {recordFor === null ? (
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnPrimary} onClick={() => setRecordFor('any')}>+ Record a payment</button>
        </div>
      ) : (
        <RecordPaymentForm
          key={recordFor}
          subscribers={activeSubs}
          fixedSubscriberId={recordFor === 'any' ? undefined : recordFor}
          payments={data.payments}
          plans={data.plans}
          onSaved={onChanged}
          onCancel={() => setRecordFor(null)}
          say={say}
        />
      )}

      {/* ── Plans ── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Plans and prices</div>
        <span className={styles.hint}>
          What you charge for each plan, in S$ for the whole plan. It prefills the amount when you record a payment; it does not change
          any subscriber&apos;s price per issue.
        </span>
        {PLAN_MONTHS.map((m) => {
          const d = planDraft(m);
          const per = d.price.trim() !== '' && Number(d.price) >= 0 ? Number(d.price) / m : null;
          return (
            <div key={m} className={styles.planRow}>
              <span className={styles.planName}>{planLabel(m)}</span>
              <label className={styles.field}>
                <span className={styles.planPer}>Price (S$){per !== null ? ` · ${money(per)} a month` : ''}</span>
                <input type="number" min="0" step="0.01" value={d.price} placeholder="Not set"
                  onChange={(e) => setEdits((x) => ({ ...x, [m]: { ...x[m], price: e.target.value } }))}
                  aria-label={`${planLabel(m)} plan price`} />
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={d.active}
                  onChange={(e) => setEdits((x) => ({ ...x, [m]: { ...x[m], is_active: e.target.checked } }))} />
                <span>Offered</span>
              </label>
              <button type="button" className={styles.btn} onClick={() => savePlan(m)} disabled={!d.dirty || savingPlan === m}>
                {savingPlan === m ? 'Saving…' : 'Save'}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Who needs to pay ── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Needs a payment <span className={styles.count}>{view.attention.length}</span></div>
        {view.attention.length === 0 ? (
          <p className={styles.hint}>Everyone who is active is paid up for {month(nowYm)} and the month after.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Subscriber</th><th>Status</th><th>Paid through</th><th>Next to collect</th><th>Chose</th><th /></tr>
              </thead>
              <tbody>
                {view.attention.map(({ sub, status }) => (
                  <tr key={sub.id}>
                    <td>
                      <button type="button" className={styles.linkBtn} onClick={() => onOpenSubscriber(sub.id)}>{sub.name}</button>
                      <div className={styles.addr}>{sub.payment_ref} · {sub.country}</div>
                    </td>
                    <td><PayBadge status={status} /></td>
                    <td>{status.paidThrough ? month(status.paidThrough) : '—'}</td>
                    <td>{month(status.nextUnpaid)}</td>
                    <td>
                      {sub.plan_months ? planLabel(sub.plan_months) : '—'}
                      {sub.preferred_method && <div className={styles.addr}>{METHOD_LABEL[sub.preferred_method]}</div>}
                    </td>
                    <td>
                      <button type="button" className={styles.btnPrimarySm} onClick={() => setRecordFor(sub.id)}>Record payment</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── All payments ── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>All payments <span className={styles.count}>{shown.length}</span></div>
        <div className={styles.filters}>
          <input type="search" placeholder="Search name, reference…" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search payments" />
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as 'all' | PaymentMethod)} aria-label="Filter by method">
            <option value="all">All methods</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
          <label className={styles.check}>
            <input type="checkbox" checked={showRefunded} onChange={(e) => setShowRefunded(e.target.checked)} />
            <span>Show refunded</span>
          </label>
        </div>
        {shown.length === 0 ? (
          <p className={styles.hint}>{data.payments.length === 0 ? 'No payments recorded yet. When someone pays by PayNow or Revolut, record it here or on their subscriber page.' : 'No payments match.'}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Received</th><th>Subscriber</th><th>Plan</th><th>Covers</th><th>Paid by</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const s = subById.get(p.subscriber_id);
                  return (
                    <tr key={p.id} className={p.status === 'refunded' ? styles.dim : undefined}>
                      <td>{p.paid_on}</td>
                      <td>
                        {s
                          ? <button type="button" className={styles.linkBtn} onClick={() => onOpenSubscriber(s.id)}>{s.name}</button>
                          : 'Unknown'}
                        {s?.payment_ref && <div className={styles.addr}>{s.payment_ref}</div>}
                      </td>
                      <td>{planLabel(p.plan_months)}</td>
                      <td>{coverageText(p)}</td>
                      <td>
                        {METHOD_LABEL[p.method]}
                        {p.reference && <div className={styles.addr}>{p.reference}</div>}
                      </td>
                      <td>
                        {money(Number(p.amount_sgd))}
                        {p.currency !== 'SGD' && <div className={styles.addr}>{Number(p.amount).toFixed(2)} {p.currency}</div>}
                      </td>
                      <td>{p.status === 'refunded' ? 'Refunded' : 'Received'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
