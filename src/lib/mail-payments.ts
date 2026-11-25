// Payment plans and "who is paid up for which month" — shared by the server and the admin screens.
// Pure functions only (no secrets, no I/O), so the same rules apply everywhere.
//
// How coverage works
//   A payment covers `plan_months` months starting at `period_start`
//   (3 months from 2026-12-01 covers Dec 2026, Jan 2027, Feb 2027).
//   A subscriber is covered for a month if any RECEIVED payment covers it.
//   Refunded payments cover nothing and count as no money.

import {
  addMonths, todaySG,
  type MailPayment, type MailSubscriber, type PaymentMethod,
} from './mail';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  paynow: 'PayNow',
  revolut: 'Revolut',
  bank: 'Bank transfer',
  other: 'Other',
};

export const planLabel = (months: number): string => `${months} months`;

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

/** Is the subscriber covered for 'YYYY-MM'? Free subscribers (price 0) always are. */
export function isCovered(sub: Pick<MailSubscriber, 'price_per_issue'>, payments: MailPayment[], ym: string): boolean {
  if (Number(sub.price_per_issue) === 0) return true;
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
  | 'free'       // price per issue is 0 — nothing to collect
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
  sub: Pick<MailSubscriber, 'price_per_issue'>,
  payments: MailPayment[],
  nowYm: string = currentMonthSG(),
): PayStatus {
  const through = paidThrough(payments);
  const nextUnpaid = firstUncoveredMonth(payments, nowYm);
  if (Number(sub.price_per_issue) === 0) {
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
