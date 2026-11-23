// Shared types + small helpers for the snail mail feature.
// Safe to import from both server and client code (contains no secrets).

// The Google Form people use to sign up for the monthly postcards.
export const POSTCARD_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfna-g4OAw_8KaZwFybniMFljv7HoIUX9TP6XYS7EsBe9i7nQ/viewform?usp=dialog';

// ── Statuses ─────────────────────────────────────────────────────
export const SUBSCRIBER_STATUSES = ['active', 'paused', 'cancelled'] as const;
export const ISSUE_STATUSES      = ['planning', 'printing', 'ready', 'shipped'] as const;
export const SHIPMENT_STATUSES   = ['pending', 'printed', 'mailed', 'delivered', 'returned'] as const;

// Payment plans offered (months paid up front) and how people pay. There is no 1-month plan.
export const PLAN_MONTHS     = [3, 6, 12] as const;
export const PAYMENT_METHODS = ['paynow', 'revolut', 'bank', 'other'] as const;
export const PAYMENT_STATUSES = ['received', 'refunded'] as const;

export type PlanMonths = (typeof PLAN_MONTHS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];
export type IssueStatus      = (typeof ISSUE_STATUSES)[number];
export type ShipmentStatus   = (typeof SHIPMENT_STATUSES)[number];

// ── Rows (match supabase/migration_snail_mail.sql) ───────────────
export interface MailSubscriber {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string;
  status: SubscriberStatus;
  price_per_issue: number;
  source: string | null;
  notes: string | null;
  joined_on: string;
  created_at: string;
  // Payment CRM (supabase/migration_payments.sql)
  payment_ref?: string;                 // code the subscriber writes on their transfer
  plan_months?: PlanMonths | null;      // the plan they chose
  preferred_method?: PaymentMethod | null;
}

export interface MailPlan {
  months: PlanMonths;
  price: number | null;                 // S$ for the whole plan; null = not set yet
  is_active: boolean;
  updated_at: string;
}

export interface MailPayment {
  id: string;
  subscriber_id: string;
  paid_on: string;                      // 'YYYY-MM-DD'
  method: PaymentMethod;
  plan_months: PlanMonths;
  period_start: string;                 // first month covered, 'YYYY-MM-01'
  amount: number;                       // what the customer sent, in `currency`
  currency: string;                     // 'SGD', 'USD', ...
  amount_sgd: number;                   // what it is worth to you in S$
  reference: string | null;
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
}

export interface MailIssue {
  id: string;
  issue_month: string; // 'YYYY-MM-01'
  city: string;
  country: string | null;
  title: string | null;
  image_url: string | null;   // postcard design (its own collection, not an artwork)
  image_path: string | null;  // storage path, so the file can be replaced or removed
  highlights: string | null;
  story: string | null;
  status: IssueStatus;
  is_published: boolean;
  print_cost: number;
  postage_local: number;
  postage_intl: number;
  packaging_cost: number;
  notes: string | null;
  created_at: string;
}

export interface MailShipment {
  id: string;
  issue_id: string;
  subscriber_id: string;
  status: ShipmentStatus;
  mailed_on: string | null;
  tracking_ref: string | null;
  price_charged: number;
  print_cost: number;
  postage_cost: number;
  packaging_cost: number;
  notes: string | null;
  created_at: string;
}

export interface MailData {
  subscribers: MailSubscriber[];
  issues: MailIssue[];
  shipments: MailShipment[];
  payments: MailPayment[];
  plans: MailPlan[];
  /** true when supabase/migration_payments.sql has not been run yet */
  paymentsSetupNeeded: boolean;
}

// What the PUBLIC /postcards page is allowed to know about an issue.
// Deliberately excludes highlights, story and every cost.
export interface PublicIssue {
  id: string;
  issue_month: string;
  city: string;
  country: string | null;
  title: string | null;
  image_url: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Postage for Singapore addresses is priced separately from overseas ones. */
export function isLocalCountry(country: string | null | undefined): boolean {
  // Forgiving about how people type it on a form: "SG.", "Republic of Singapore", "Singapura"…
  const c = (country ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return c === 'sg' || c === 'sgp' || c === 'singapura' || c === 'singapore' || c === 'republic of singapore';
}

/** 'YYYY-MM-DD' -> 'November 2026'. Fixed locale + UTC so server and browser always agree. */
export function formatMonth(isoDate: string, style: 'long' | 'short' = 'long'): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { month: style, year: 'numeric', timeZone: 'UTC' });
}

/** 'YYYY-MM' plus n months -> 'YYYY-MM' (n may be negative). */
export function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.slice(0, 7).split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Today's date in Singapore as 'YYYY-MM-DD' (the artist's timezone, not the server's). */
export function todaySG(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

export const money = (n: number): string =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(Number.isFinite(n) ? n : 0);

/**
 * Money for one shipment. Costs are incurred once a card is mailed (or came back);
 * revenue only counts for cards that were mailed or delivered.
 */
export function shipmentMoney(s: MailShipment) {
  const cost = Number(s.print_cost) + Number(s.postage_cost) + Number(s.packaging_cost);
  const incurred = s.status === 'mailed' || s.status === 'delivered' || s.status === 'returned';
  const earned   = s.status === 'mailed' || s.status === 'delivered';
  return {
    revenue: earned   ? Number(s.price_charged) : 0,
    cost:    incurred ? cost : 0,
  };
}

/** Formats a subscriber's address as printable lines. */
export function addressLines(s: MailSubscriber): string[] {
  return [
    s.name,
    s.address_line1,
    s.address_line2 ?? '',
    [s.city, s.state_region].filter(Boolean).join(', '),
    [s.postal_code, s.country].filter(Boolean).join(' '),
  ].filter((l) => l.trim() !== '');
}
