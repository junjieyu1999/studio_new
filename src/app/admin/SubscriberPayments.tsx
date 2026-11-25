'use client';

// The "Payments" section of one subscriber: where they stand, the reference to write on their
// transfer, a form to record a payment, and the history of what they have paid.

import { useState } from 'react';
import {
  type MailPayment, type MailPlan, type MailSubscriber,
  formatMonth, money,
} from '@/lib/mail';
import { METHOD_LABEL, lastMonthCovered, monthsLabel, payStatus, paymentPlanName, planOf } from '@/lib/mail-payments';
import { adminApi } from '@/lib/admin-fetch';
import RecordPaymentForm from './RecordPaymentForm';
import PayBadge from './PayBadge';
import styles from './AdminMail.module.css';

interface Props {
  subscriber: MailSubscriber;
  payments: MailPayment[];          // this subscriber's payments
  allPayments: MailPayment[];
  plans: MailPlan[];
  setupNeeded: boolean;
  onChanged: () => Promise<void> | void;
  say: (kind: 'ok' | 'err', text: string) => void;
}

const month = (ym: string) => formatMonth(`${ym}-01`, 'short');

export function coverageText(p: Pick<MailPayment, 'period_start' | 'plan_months'>): string {
  const start = p.period_start.slice(0, 7);
  const end = lastMonthCovered(p);
  return start === end ? month(start) : `${month(start)} – ${month(end)}`;
}

/** The plan a payment was recorded under, with its length underneath when the name does not already say it. */
export function PlanCell({ payment, plans }: { payment: Pick<MailPayment, 'plan_id' | 'plan_months'>; plans: MailPlan[] }) {
  const name = paymentPlanName(payment, plans);
  const len = monthsLabel(payment.plan_months);
  return (
    <>
      {name}
      {name.toLowerCase() !== len && <div className={styles.addr}>{len}</div>}
    </>
  );
}

export default function SubscriberPayments({ subscriber, payments, allPayments, plans, setupNeeded, onChanged, say }: Props) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState('');

  if (setupNeeded) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Payments</div>
        <p className={styles.hintWarn}>
          Payment tracking is not set up yet. In the Supabase SQL Editor, run <code>supabase/migration_payments.sql</code> and then <code>supabase/migration_custom_plans.sql</code>, then reload this page.
        </p>
      </div>
    );
  }

  const status = payStatus(subscriber, payments, undefined, plans);
  const sorted = [...payments].sort((a, b) =>
    b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at));

  const copyRef = async () => {
    if (!subscriber.payment_ref) return;
    try {
      await navigator.clipboard.writeText(subscriber.payment_ref);
      say('ok', `Copied ${subscriber.payment_ref}.`);
    } catch {
      say('err', 'Could not copy. Select the reference and copy it by hand.');
    }
  };

  const setStatus = async (p: MailPayment, next: 'received' | 'refunded') => {
    const q = next === 'refunded'
      ? `Mark this ${money(Number(p.amount_sgd))} payment as refunded? It will stop counting as money received and no longer covers ${coverageText(p)}.`
      : 'Mark this payment as received again?';
    if (!window.confirm(q)) return;
    setBusy(p.id);
    try {
      await adminApi('PATCH', `/api/admin/mail/payments/${p.id}`, { status: next });
      await onChanged();
      say('ok', next === 'refunded' ? 'Marked as refunded.' : 'Marked as received.');
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy('');
    }
  };

  const remove = async (p: MailPayment) => {
    if (!window.confirm('Delete this payment record? Use this only for a payment entered by mistake. This cannot be undone.')) return;
    setBusy(p.id);
    try {
      await adminApi('DELETE', `/api/admin/mail/payments/${p.id}`);
      await onChanged();
      say('ok', 'Payment deleted.');
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Payments</div>

      <div className={styles.paySummary}>
        <PayBadge status={status} />
        <span className={styles.payLine}>
          {status.state === 'free' && (planOf(subscriber, plans)?.is_complimentary
            ? `No payment needed (on the ${planOf(subscriber, plans)?.name} plan).`
            : 'No payment needed (price per issue is S$0).')}
          {status.state !== 'free' && status.paidThrough && <>Paid through <strong>{month(status.paidThrough)}</strong>. </>}
          {status.state !== 'free' && !status.paidThrough && 'Nothing paid yet. '}
          {status.state !== 'free' && <>Next month to collect: <strong>{month(status.nextUnpaid)}</strong>.</>}
        </span>
      </div>

      <div className={styles.refRow}>
        <span className={styles.refLabel}>Reference to write on their PayNow / Revolut transfer</span>
        <code className={styles.refCode}>{subscriber.payment_ref ?? '—'}</code>
        {subscriber.payment_ref && <button type="button" className={styles.btn} onClick={copyRef}>Copy</button>}
      </div>

      {!adding && (
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnPrimarySm} onClick={() => setAdding(true)}>+ Record payment</button>
        </div>
      )}
      {adding && (
        <RecordPaymentForm
          subscribers={[subscriber]}
          fixedSubscriberId={subscriber.id}
          payments={allPayments}
          plans={plans}
          onSaved={onChanged}
          onCancel={() => setAdding(false)}
          say={say}
        />
      )}

      {sorted.length === 0 ? (
        <p className={styles.hint}>No payments recorded yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Received</th><th>Plan</th><th>Covers</th><th>Paid by</th><th>Amount</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className={p.status === 'refunded' ? styles.dim : undefined}>
                  <td>{p.paid_on}</td>
                  <td><PlanCell payment={p} plans={plans} /></td>
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
                  <td>
                    <div className={styles.toolbar}>
                      <button type="button" className={styles.btn} disabled={busy === p.id}
                        onClick={() => setStatus(p, p.status === 'refunded' ? 'received' : 'refunded')}>
                        {p.status === 'refunded' ? 'Undo refund' : 'Refund'}
                      </button>
                      <button type="button" className={styles.btnDanger} disabled={busy === p.id} onClick={() => remove(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
