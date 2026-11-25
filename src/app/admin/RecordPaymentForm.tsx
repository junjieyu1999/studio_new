'use client';

// Form for recording one payment (PayNow, Revolut, bank transfer…).
// Used inside a subscriber's screen (subscriber fixed) and from the Payments tab (subscriber chosen).
// The server re-checks everything; the checks here just give quicker, friendlier feedback.

import { useEffect, useRef, useState } from 'react';
import {
  type MailPayment, type MailPlan, type MailSubscriber, type PaymentMethod,
  PAYMENT_METHODS, formatMonth, money, todaySG,
} from '@/lib/mail';
import {
  METHOD_LABEL, currentMonthSG, firstUncoveredMonth, lastMonthCovered, overlappingMonths, planChoices, planOptionLabel,
} from '@/lib/mail-payments';
import { adminApi } from '@/lib/admin-fetch';
import styles from './AdminMail.module.css';

interface Props {
  subscribers: MailSubscriber[];          // the subscriber to pick from (one entry when fixed)
  fixedSubscriberId?: string;             // set when opened from a subscriber's screen
  payments: MailPayment[];                // all payments (used to suggest the start month and spot overlaps)
  plans: MailPlan[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
  say: (kind: 'ok' | 'err', text: string) => void;
}

interface FormState {
  subscriberId: string;
  plan: string;           // a plan id, or CUSTOM for a one-off length
  months: string;         // how many months this payment covers
  start: string;          // 'YYYY-MM'
  method: PaymentMethod;
  paidOn: string;
  amount: string;
  currency: string;
  amountSgd: string;
  reference: string;
  notes: string;
}

const CUSTOM = 'custom';

/** What to prefill as the amount for a plan: its price, or 0 for a no-payment-needed plan. */
const planAmount = (plan: MailPlan | undefined): string =>
  !plan ? '' : plan.price !== null ? String(plan.price) : plan.is_complimentary ? '0' : '';

function initialFor(
  sub: MailSubscriber | undefined, payments: MailPayment[], plans: MailPlan[],
): FormState {
  const chosen = sub?.plan_id ? plans.find((p) => p.id === sub.plan_id) : undefined;
  const plan = chosen ?? planChoices(plans)[0];
  const mine = sub ? payments.filter((p) => p.subscriber_id === sub.id) : [];
  return {
    subscriberId: sub?.id ?? '',
    plan: plan ? plan.id : CUSTOM,
    months: plan ? String(plan.months) : '12',
    start: firstUncoveredMonth(mine, currentMonthSG()),
    method: sub?.preferred_method ?? 'paynow',
    paidOn: todaySG(),
    amount: planAmount(plan),
    currency: 'SGD',
    amountSgd: '',
    reference: '',
    notes: '',
  };
}

export default function RecordPaymentForm({
  subscribers, fixedSubscriberId, payments, plans, onSaved, onCancel, say,
}: Props) {
  const [f, setF] = useState<FormState>(() =>
    initialFor(subscribers.find((s) => s.id === fixedSubscriberId), payments, plans));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  // The form can open far from the button that was clicked (for example from a row low on the
  // page), so bring it into view.
  useEffect(() => {
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const pickSubscriber = (id: string) =>
    setF(initialFor(subscribers.find((s) => s.id === id), payments, plans));

  const pickPlan = (plan: string) =>
    setF((s) => {
      if (plan === CUSTOM) return { ...s, plan };            // keep the months and amount typed so far
      const p = plans.find((x) => x.id === plan);
      if (!p) return { ...s, plan };
      // Prefill the length and (for SGD, when the plan has a price) the amount.
      const amt = planAmount(p);
      return { ...s, plan, months: String(p.months), amount: s.currency === 'SGD' && amt !== '' ? amt : s.amount };
    });

  const foreign = f.currency !== 'SGD';
  const months = Number(f.months);
  const monthsOk = Number.isInteger(months) && months >= 1 && months <= 120;
  const covers = monthsOk && /^\d{4}-\d{2}$/.test(f.start)
    ? `${formatMonth(`${f.start}-01`, 'short')} – ${formatMonth(`${lastMonthCovered({ period_start: `${f.start}-01`, plan_months: months })}-01`, 'short')}`
    : '';
  const selectedPlan = plans.find((p) => p.id === f.plan);

  const save = async () => {
    setFormError('');
    if (!f.subscriberId) return setFormError('Choose a subscriber.');
    if (!monthsOk) return setFormError('Enter how many months this payment covers (1 to 120).');
    if (!/^\d{4}-\d{2}$/.test(f.start)) return setFormError('Choose the first month this payment covers.');
    if (!f.paidOn) return setFormError('Enter the date you received it.');
    if (f.amount.trim() === '' || !Number.isFinite(Number(f.amount)) || Number(f.amount) < 0) {
      return setFormError('Enter the amount that was paid.');
    }
    if (!/^[A-Za-z]{3}$/.test(f.currency)) return setFormError('Currency must be a 3-letter code such as SGD or USD.');
    if (foreign && (f.amountSgd.trim() === '' || !Number.isFinite(Number(f.amountSgd)) || Number(f.amountSgd) < 0)) {
      return setFormError(`Enter what the ${f.currency} payment is worth in S$.`);
    }

    // Warn before recording a payment on top of months that are already paid for.
    const mine = payments.filter((p) => p.subscriber_id === f.subscriberId);
    const clash = overlappingMonths(mine, f.start, months);
    let confirmOverlap = false;
    if (clash.length > 0) {
      const names = clash.map((m) => formatMonth(`${m}-01`, 'short')).join(', ');
      if (!window.confirm(`This overlaps months already paid for (${names}).\n\nRecord it anyway?`)) return;
      confirmOverlap = true;
    }

    setSaving(true);
    try {
      await adminApi('POST', '/api/admin/mail/payments', {
        subscriber_id: f.subscriberId,
        paid_on: f.paidOn,
        method: f.method,
        plan_months: months,
        plan_id: f.plan === CUSTOM ? null : f.plan,
        period_start: f.start,
        amount: Number(f.amount),
        currency: f.currency.toUpperCase(),
        ...(foreign ? { amount_sgd: Number(f.amountSgd) } : {}),
        reference: f.reference,
        notes: f.notes,
        ...(confirmOverlap ? { confirm_overlap: true } : {}),
      });
      await onSaved();
      say('ok', 'Payment recorded.');
      onCancel();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={boxRef} className={styles.payForm} role="group" aria-label="Record a payment">
      <div className={styles.sectionLabel}>Record a payment</div>

      {!fixedSubscriberId && (
        <label className={styles.field}>Subscriber *
          <select value={f.subscriberId} onChange={(e) => pickSubscriber(e.target.value)}>
            <option value="">Choose…</option>
            {subscribers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.payment_ref ? ` · ${s.payment_ref}` : ''}</option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.gridPay}>
        <label className={styles.field}>Plan
          <select value={f.plan} onChange={(e) => pickPlan(e.target.value)}>
            {planChoices(plans, f.plan).map((p) => (
              <option key={p.id} value={p.id}>{planOptionLabel(p)}</option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
        </label>
        <label className={styles.field}>Months covered
          <input type="number" min="1" max="120" step="1" value={f.months} onChange={(e) => set('months', e.target.value)} />
        </label>
        <label className={styles.field}>First month covered
          <input type="month" value={f.start} onChange={(e) => set('start', e.target.value)} />
        </label>
        <label className={styles.field}>Date received
          <input type="date" value={f.paidOn} onChange={(e) => set('paidOn', e.target.value)} />
        </label>
      </div>
      {covers && <span className={styles.hint}>Covers {covers}{months > 1 ? ` (${months} postcards)` : ' (1 postcard)'}.</span>}
      {f.plan === CUSTOM && <span className={styles.hint}>A one-off length, not tied to a plan. Add it under Plans and prices if you will use it again.</span>}
      {selectedPlan && selectedPlan.price !== null && !selectedPlan.is_complimentary && f.amount !== '' && Number(f.amount) !== selectedPlan.price && f.currency === 'SGD' && (
        <span className={styles.hint}>The {selectedPlan.name} price is {money(selectedPlan.price)}; you entered a different amount, which is fine.</span>
      )}

      <div className={styles.grid4}>
        <label className={styles.field}>Paid by
          <select value={f.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </label>
        <label className={styles.field}>Amount received *
          <input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
        </label>
        <label className={styles.field}>Currency
          <input type="text" list="pay-currencies" maxLength={3} value={f.currency}
            onChange={(e) => set('currency', e.target.value.toUpperCase())} autoComplete="off" />
          <datalist id="pay-currencies">
            <option value="SGD" /><option value="USD" /><option value="EUR" /><option value="GBP" />
            <option value="AUD" /><option value="MYR" />
          </datalist>
        </label>
        {foreign && (
          <label className={styles.field}>Worth in S$ *
            <input type="number" min="0" step="0.01" value={f.amountSgd} onChange={(e) => set('amountSgd', e.target.value)} />
          </label>
        )}
      </div>
      {foreign && (
        <span className={styles.hint}>
          Enter what this {f.currency || 'foreign-currency'} payment is worth to you in Singapore dollars (for example the amount once converted),
          so your totals stay in one currency.
        </span>
      )}

      <label className={styles.field}>Their transfer reference
        <input type="text" value={f.reference} onChange={(e) => set('reference', e.target.value)} autoComplete="off" />
      </label>

      <label className={styles.field}>Notes
        <textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {formError && <p className={styles.errBanner} role="alert">{formError}</p>}

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save payment'}
        </button>
        <button type="button" className={styles.btn} onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
