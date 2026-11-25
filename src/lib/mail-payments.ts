// Payment plans and "who is paid up for which month" — shared by the server and the admin screens.
// Pure functions only (no secrets, no I/O), so the same rules apply everywhere.
//
// How coverage works
//   A payment covers `plan_months` months starting at `period_start`
//   (3 months from 2026-12-01 covers Dec 2026, Jan 2027, Feb 2027).
//   A subscriber is covered for a month if any RECEIVED payment covers it.
//   Refunded payments cover nothing and count as no money.

import {
  addMonths, money, todaySG,
  type MailPayment, type MailPlan, type MailSubscriber, type PaymentMethod,
} from './mail';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  paynow: 'PayNow',
  revolut: 'Revolut',
  bank: 'Bank transfer',
  other: 'Other',
};

export const monthsLabel = (months: number): string => `${months} month${months === 1 ? '' : 's'}`;

/** The plan a subscriber chose, if it still exists. */
export const planOf = (sub: Pick<MailSubscriber, 'plan_id'>, plans: MailPlan[]): MailPlan | undefined =>
  sub.plan_id ? plans.find((p) => p.id === sub.plan_id) : undefined;

/** Nothing to collect: price per issue is 0, or they are on a "no payment needed" plan. */
export const isComplimentary = (sub: Pick<MailSubscriber, 'price_per_issue' | 'plan_id'>, plans: MailPlan[]): boolean =>
  Number(sub.price_per_issue) === 0 || planOf(sub, plans)?.is_complimentary === true;

/**
 * Name of the plan a payment was recorded under. A payment with no plan (a one-off length, or one
 * recorded before plans could be linked) shows the standard "N months" plan when its length matches,
 * otherwise 'Custom'.
 */
export const paymentPlanName = (p: Pick<MailPayment, 'plan_id' | 'plan_months'>, plans: MailPlan[]): string =>
  (p.plan_id ? plans.find((x) => x.id === p.plan_id)?.name : undefined)
  ?? plans.find((x) => !x.is_complimentary && x.name.trim().toLowerCase() === monthsLabel(p.plan_months))?.name
  ?? 'Custom';

/** How a plan reads in a dropdown: 'Friends & family · no payment needed', '6 months · S$30.00', 'Student · 6 months'. */
export function planOptionLabel(plan: MailPlan, withPrice = true): string {
  const len = monthsLabel(plan.months);
  if (plan.is_complimentary) return `${plan.name} · no payment needed`;
  const parts = [plan.name];
  if (plan.name.trim().toLowerCase() !== len) parts.push(len);
  if (withPrice && plan.price !== null) parts.push(money(plan.price));
  return parts.join(' · ');
}

/** Plans for a dropdown: offered ones by length then name, plus `keepId` even if it is no longer offered. */
export function planChoices(plans: MailPlan[], keepId?: string | null): MailPlan[] {
  return plans
    .filter((p) => p.is_active || p.id === keepId)
    .sort((a, b) => a.months - b.months || a.name.localeCompare(b.name));
}

/** Current month in Singapore as 'YYYY-MM'. */
export const currentMonthSG = (): string => todaySG().slice(0, 7);

/** The last month a payment covers, 'YYYY-MM'. */
export function lastMonthCovered(p: Pick<MailPayment, 'period_start' | 'plan_months'>): string {
  return addMonths(p.period_start.slice(0, 7), p.plan_months - 1);
}

/** Does this payment cover the month 'YYYY-MM'? Refunded payments never do. */
export function paymentCovers(p: MailPayment, ym: string): boolean {
  if (p.status !== 'received') return false;
  const start = p.period_start.slice(0, 7);
  return ym >= start && ym <= lastMonthCovered(p);
}

/** Is the subscriber covered for 'YYYY-MM'? Free subscribers (price 0, or a no-payment-needed plan) always are. */
export function isCovered(
  sub: Pick<MailSubscriber, 'price_per_issue' | 'plan_id'>, payments: MailPayment[], ym: string, plans: MailPlan[] = [],
): boolean {
  if (isComplimentary(sub, plans)) return true;
  return payments.some((p) => paymentCovers(p, ym));
}

/** First month from `fromYm` onward that is not covered by any received payment. */
export function firstUncoveredMonth(payments: MailPayment[], fromYm: string): string {
  let ym = fromYm;
  for (let i = 0; i < 600; i++) {            // 50 years is plenty; the loop always ends well before
    if (!payments.some((p) => paymentCovers(p, ym))) return ym;
    ym = addMonths(ym, 1);
  }
  return ym;
}

/** The latest month any received payment covers, or null if nothing has been paid. */
export function paidThrough(payments: MailPayment[]): string | null {
  let best: string | null = null;
  for (const p of payments) {
    if (p.status !== 'received') continue;
    const end = lastMonthCovered(p);
    if (best === null || end > best) best = end;
  }
  return best;
}

export type PayState =
  | 'free'       // price per issue is 0, or on a no-payment-needed plan — nothing to collect
  | 'paid'       // covered this month and next
  | 'renew'      // covered this month, but NOT next month — renewal due
  | 'lapsed'     // not covered this month, has paid before
  | 'unpaid';    // never paid

export interface PayStatus {
  state: PayState;
  label: string;
  paidThrough: string | null;   // 'YYYY-MM'
  nextUnpaid: string;           // first month not covered, from this month on
}

/** Where one subscriber stands right now. `payments` must be THAT subscriber's payments. */
export function payStatus(
  sub: Pick<MailSubscriber, 'price_per_issue' | 'plan_id'>,
  payments: MailPayment[],
  nowYm: string = currentMonthSG(),
  plans: MailPlan[] = [],
): PayStatus {
  const through = paidThrough(payments);
  const nextUnpaid = firstUncoveredMonth(payments, nowYm);
  if (isComplimentary(sub, plans)) {
    return { state: 'free', label: 'Free', paidThrough: through, nextUnpaid };
  }
  const coveredNow = payments.some((p) => paymentCovers(p, nowYm));
  if (!coveredNow) {
    return through
      ? { state: 'lapsed', label: 'Lapsed', paidThrough: through, nextUnpaid }
      : { state: 'unpaid', label: 'Not paid yet', paidThrough: null, nextUnpaid };
  }
  const coveredNext = payments.some((p) => paymentCovers(p, addMonths(nowYm, 1)));
  return coveredNext
    ? { state: 'paid', label: 'Paid', paidThrough: through, nextUnpaid }
    : { state: 'renew', label: 'Renewal due', paidThrough: through, nextUnpaid };
}

/** Groups payments by subscriber id. */
export function paymentsBySubscriber(payments: MailPayment[]): Map<string, MailPayment[]> {
  const m = new Map<string, MailPayment[]>();
  for (const p of payments) {
    const list = m.get(p.subscriber_id);
    if (list) list.push(p); else m.set(p.subscriber_id, [p]);
  }
  return m;
}

/** Money actually received (in S$), ignoring refunded payments. */
export const receivedTotal = (payments: MailPayment[]): number =>
  payments.reduce((sum, p) => sum + (p.status === 'received' ? Number(p.amount_sgd) : 0), 0);

/** Does a new payment of `months` from `startYm` overlap months already covered? Returns those months. */
export function overlappingMonths(existing: MailPayment[], startYm: string, months: number): string[] {
  const hit: string[] = [];
  for (let i = 0; i < months; i++) {
    const ym = addMonths(startYm, i);
    if (existing.some((p) => paymentCovers(p, ym))) hit.push(ym);
  }
  return hit;
}
