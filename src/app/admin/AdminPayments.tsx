'use client';

// Snail mail → Payments. The money side of the subscription CRM:
//   • totals (received this month / in total / by method)
//   • your plans and prices (3, 6 and 12 months, Friends & family, or any you add)
//   • who needs to pay or renew
//   • every payment, newest first
// All figures are computed from the payments you record, in Singapore dollars.

import { useMemo, useState } from 'react';
import {
  type MailData, type MailPlan, type PaymentMethod,
  PAYMENT_METHODS, formatMonth, money,
} from '@/lib/mail';
import {
  METHOD_LABEL, currentMonthSG, payStatus, paymentsBySubscriber, planOf, receivedTotal,
} from '@/lib/mail-payments';
import { adminApi } from '@/lib/admin-fetch';
import RecordPaymentForm from './RecordPaymentForm';
import PayBadge from './PayBadge';
import { PlanCell, coverageText } from './SubscriberPayments';
import styles from './AdminMail.module.css';

interface Props {
  data: MailData;
  say: (kind: 'ok' | 'err', text: string) => void;
  onChanged: () => Promise<void> | void;
  onOpenSubscriber: (id: string) => void;
}

const month = (ym: string) => formatMonth(`${ym}-01`, 'short');

// Unsaved changes to a plan row (kept as text while typing).
interface PlanEdit { name?: string; months?: string; price?: string; is_active?: boolean; is_complimentary?: boolean }

export default function AdminPayments({ data, say, onChanged, onOpenSubscriber }: Props) {
  const [recordFor, setRecordFor] = useState<string | 'any' | null>(null);
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [showRefunded, setShowRefunded] = useState(false);
  const [query, setQuery] = useState('');
  const [edits, setEdits] = useState<Record<string, PlanEdit>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState<PlanEdit>({ name: '', months: '12', price: '', is_complimentary: false });
  const [addingPlan, setAddingPlan] = useState(false);

  const nowYm = currentMonthSG();
  const subById = useMemo(() => new Map(data.subscribers.map((s) => [s.id, s])), [data.subscribers]);

  const view = useMemo(() => {
    const bySub = paymentsBySubscriber(data.payments);
    const rows = data.subscribers
      .filter((s) => s.status === 'active')
      .map((s) => ({ sub: s, status: payStatus(s, bySub.get(s.id) ?? [], nowYm, data.plans) }));
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
  }, [data.payments, data.subscribers, data.plans, nowYm]);

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
          Payment tracking is not set up yet. In the Supabase SQL Editor, run <code>supabase/migration_payments.sql</code> and then
          <code> supabase/migration_custom_plans.sql</code> (each only needs to be run once), then reload this page.
        </p>
      </div>
    );
  }

  const planDraft = (plan: MailPlan) => {
    const e = edits[plan.id];
    return {
      name: e?.name ?? plan.name,
      months: e?.months ?? String(plan.months),
      price: e?.price ?? (plan.price === null ? '' : String(plan.price)),
      active: e?.is_active ?? plan.is_active,
      comp: e?.is_complimentary ?? plan.is_complimentary,
      dirty: e !== undefined,
    };
  };
  const editPlan = (id: string, patch: PlanEdit) => setEdits((x) => ({ ...x, [id]: { ...x[id], ...patch } }));

  const planProblem = (name: string, months: string, price: string): string => {
    if (name.trim() === '') return 'Give the plan a name.';
    const m = Number(months);
    if (months.trim() === '' || !Number.isInteger(m) || m < 1 || m > 120) return 'Months must be a whole number from 1 to 120.';
    if (price.trim() !== '' && (!Number.isFinite(Number(price)) || Number(price) < 0)) return 'The price must be a number, or left blank.';
    return '';
  };

  const savePlan = async (plan: MailPlan) => {
    const d = planDraft(plan);
    const problem = planProblem(d.name, d.months, d.price);
    if (problem) return say('err', problem);
    setSavingPlan(plan.id);
    try {
      await adminApi('PATCH', `/api/admin/mail/plans/${plan.id}`, {
        name: d.name.trim(), months: Number(d.months), price: d.price.trim() === '' ? null : Number(d.price),
        is_active: d.active, is_complimentary: d.comp,
      });
      await onChanged();
      setEdits((e) => { const n = { ...e }; delete n[plan.id]; return n; });
      say('ok', `${d.name.trim()} saved.`);
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      setSavingPlan(null);
    }
  };

  const addPlan = async () => {
    const problem = planProblem(newPlan.name ?? '', newPlan.months ?? '', newPlan.price ?? '');
    if (problem) return say('err', problem);
    setAddingPlan(true);
    try {
      await adminApi('POST', '/api/admin/mail/plans', {
        name: (newPlan.name ?? '').trim(), months: Number(newPlan.months),
        price: (newPlan.price ?? '').trim() === '' ? null : Number(newPlan.price),
        is_complimentary: newPlan.is_complimentary === true,
      });
      await onChanged();
      setNewPlan({ name: '', months: '12', price: '', is_complimentary: false });
      say('ok', `${(newPlan.name ?? '').trim()} added. It now appears in the plan dropdowns.`);
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not add the plan.');
    } finally {
      setAddingPlan(false);
    }
  };

  const deletePlan = async (plan: MailPlan) => {
    if (!window.confirm(`Delete the "${plan.name}" plan? This cannot be undone.`)) return;
    setSavingPlan(plan.id);
    try {
      await adminApi('DELETE', `/api/admin/mail/plans/${plan.id}`);
      await onChanged();
      say('ok', `${plan.name} deleted.`);
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not delete the plan.');
    } finally {
      setSavingPlan(null);
    }
  };

  const sortedPlans = [...data.plans].sort((a, b) => a.months - b.months || a.name.localeCompare(b.name));
  const planUse = (id: string) => ({
    subs: data.subscribers.filter((s) => s.plan_id === id).length,
    pays: data.payments.filter((p) => p.plan_id === id).length,
  });

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
          Every plan here appears in the same dropdowns, when you record a payment and on a subscriber. The price is for the whole plan, in S$,
          and only prefills the amount; it does not change a subscriber&apos;s price per issue. Tick &quot;No payment needed&quot; for
          Friends &amp; family: those subscribers are never chased and always get their postcard.
        </span>
        <div className={styles.planList}>
          {sortedPlans.map((plan) => {
            const d = planDraft(plan);
            const use = planUse(plan.id);
            const per = d.price.trim() !== '' && Number(d.price) >= 0 && Number(d.months) >= 1 ? Number(d.price) / Number(d.months) : null;
            return (
              <div key={plan.id} className={styles.planCard}>
                <label className={`${styles.field} ${styles.fName}`}>Name
                  <input type="text" value={d.name} maxLength={60} onChange={(e) => editPlan(plan.id, { name: e.target.value })}
                    aria-label={`${plan.name} plan name`} />
                </label>
                <label className={`${styles.field} ${styles.fMonths}`}>Months
                  <input type="number" min="1" max="120" step="1" value={d.months} onChange={(e) => editPlan(plan.id, { months: e.target.value })}
                    aria-label={`${plan.name} plan months`} />
                </label>
                <label className={`${styles.field} ${styles.fPrice}`}>
                  <span>Price (S$){per !== null && !d.comp ? <span className={styles.planPer}> · {money(per)} a month</span> : null}</span>
                  <input type="number" min="0" step="0.01" value={d.price} placeholder="Not set"
                    onChange={(e) => editPlan(plan.id, { price: e.target.value })} aria-label={`${plan.name} plan price`} />
                </label>
                <div className={styles.planFlags}>
                  <label className={styles.check}>
                    <input type="checkbox" checked={d.comp} onChange={(e) => editPlan(plan.id, { is_complimentary: e.target.checked })}
                      aria-label={`${plan.name} no payment needed`} />
                    <span>No payment needed</span>
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" checked={d.active} onChange={(e) => editPlan(plan.id, { is_active: e.target.checked })}
                      aria-label={`${plan.name} offered`} />
                    <span>Offered</span>
                  </label>
                </div>
                <div className={styles.planActions}>
                  <button type="button" className={styles.btn} onClick={() => savePlan(plan)} disabled={!d.dirty || savingPlan === plan.id}
                    aria-label={`Save ${plan.name}`}>
                    {savingPlan === plan.id ? 'Saving…' : 'Save'}
                  </button>
                  {use.subs === 0 && use.pays === 0 && (
                    <button type="button" className={styles.btnDanger} onClick={() => deletePlan(plan)} disabled={savingPlan === plan.id}
                      aria-label={`Delete ${plan.name}`}>Delete</button>
                  )}
                </div>
                {(use.subs > 0 || use.pays > 0) && (
                  <span className={styles.planUse}>
                    Used by {use.subs} subscriber{use.subs === 1 ? '' : 's'} and {use.pays} payment{use.pays === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            );
          })}

          <div className={`${styles.planCard} ${styles.planNew}`} role="group" aria-label="Add a plan">
            <label className={`${styles.field} ${styles.fName}`}>New plan name
              <input type="text" value={newPlan.name ?? ''} maxLength={60} placeholder="For example: Friends & family"
                onChange={(e) => setNewPlan((x) => ({ ...x, name: e.target.value }))} />
            </label>
            <label className={`${styles.field} ${styles.fMonths}`}>Months
              <input type="number" min="1" max="120" step="1" value={newPlan.months ?? ''}
                onChange={(e) => setNewPlan((x) => ({ ...x, months: e.target.value }))} aria-label="New plan months" />
            </label>
            <label className={`${styles.field} ${styles.fPrice}`}>Price (S$)
              <input type="number" min="0" step="0.01" value={newPlan.price ?? ''} placeholder="Not set"
                onChange={(e) => setNewPlan((x) => ({ ...x, price: e.target.value }))} aria-label="New plan price" />
            </label>
            <div className={styles.planFlags}>
              <label className={styles.check}>
                <input type="checkbox" checked={newPlan.is_complimentary === true}
                  onChange={(e) => setNewPlan((x) => ({ ...x, is_complimentary: e.target.checked }))} aria-label="New plan no payment needed" />
                <span>No payment needed</span>
              </label>
            </div>
            <div className={styles.planActions}>
              <button type="button" className={styles.btnPrimarySm} onClick={addPlan} disabled={addingPlan}>
                {addingPlan ? 'Adding…' : '+ Add plan'}
              </button>
            </div>
          </div>
        </div>
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
                      {planOf(sub, data.plans)?.name ?? '—'}
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
                      <td><PlanCell payment={p} plans={data.plans} /></td>
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
