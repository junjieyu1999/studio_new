// Server-side input validation for the snail mail API routes.
//
// Every route runs the request body through a schema so that:
//   - only whitelisted columns can ever be written,
//   - values are trimmed, length-limited and type-checked,
//   - blank optional fields become NULL.

import {
  SUBSCRIBER_STATUSES,
  ISSUE_STATUSES,
  SHIPMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from './mail';

type Rule =
  | { kind: 'text'; max: number; nullable?: boolean; format?: 'email' | 'slug' | 'currency' }
  | { kind: 'enum'; values: readonly string[]; nullable?: boolean }
  | { kind: 'int'; min: number; max: number; nullable?: boolean }    // a whole number in a range
  | { kind: 'uuid'; nullable?: boolean }
  | { kind: 'number'; min: number; max: number; nullable?: boolean }
  | { kind: 'bool' }
  | { kind: 'date'; nullable?: boolean }
  | { kind: 'month' };

export type Schema = Record<string, Rule>;

export type ParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

const label = (key: string) => key.replace(/_/g, ' ');

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Validates `body` against `schema`.
 *  - Unknown keys are ignored (never written).
 *  - `required` lists keys that must be present and non-blank (used on create).
 */
export function parseBody(body: unknown, schema: Schema, required: string[] = []): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body.' };
  }
  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  for (const key of required) {
    const v = input[key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      return { ok: false, error: `${label(key)} is required.` };
    }
  }

  for (const [key, rule] of Object.entries(schema)) {
    if (!(key in input)) continue;
    const raw = input[key];

    switch (rule.kind) {
      case 'text': {
        if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
          if (rule.nullable) { data[key] = null; break; }
          return { ok: false, error: `${label(key)} cannot be blank.` };
        }
        if (typeof raw !== 'string') return { ok: false, error: `${label(key)} must be text.` };
        const v = raw.trim();
        if (v.length > rule.max) return { ok: false, error: `${label(key)} is too long (max ${rule.max}).` };
        if (rule.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return { ok: false, error: 'That email address does not look right.' };
        }
        if (rule.format === 'slug' && !/^[a-z0-9-]+$/.test(v)) {
          return { ok: false, error: `${label(key)} is not valid.` };
        }
        if (rule.format === 'currency') {
          if (!/^[A-Za-z]{3}$/.test(v)) return { ok: false, error: 'Currency must be a 3-letter code such as SGD or USD.' };
          data[key] = v.toUpperCase();
          break;
        }
        data[key] = v;
        break;
      }
      case 'enum': {
        if ((raw === null || raw === '') && rule.nullable) { data[key] = null; break; }
        if (typeof raw !== 'string' || !rule.values.includes(raw)) {
          return { ok: false, error: `${label(key)} must be one of: ${rule.values.join(', ')}.` };
        }
        data[key] = raw;
        break;
      }
      case 'int': {
        if ((raw === null || raw === '') && rule.nullable) { data[key] = null; break; }
        const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < rule.min || n > rule.max) {
          return { ok: false, error: `${label(key)} must be a whole number from ${rule.min} to ${rule.max}.` };
        }
        data[key] = n;
        break;
      }
      case 'uuid': {
        if ((raw === null || raw === '') && rule.nullable) { data[key] = null; break; }
        if (typeof raw !== 'string' || !isUuid(raw)) return { ok: false, error: `${label(key)} is not valid.` };
        data[key] = raw;
        break;
      }
      case 'number': {
        if ((raw === null || raw === '') && rule.nullable) { data[key] = null; break; }
        const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
        if (typeof n !== 'number' || !Number.isFinite(n) || n < rule.min || n > rule.max) {
          return { ok: false, error: `${label(key)} must be a number between ${rule.min} and ${rule.max}.` };
        }
        data[key] = Math.round(n * 100) / 100;
        break;
      }
      case 'bool': {
        if (typeof raw !== 'boolean') return { ok: false, error: `${label(key)} must be true or false.` };
        data[key] = raw;
        break;
      }
      case 'date': {
        if (raw === null || raw === '') {
          if (rule.nullable) { data[key] = null; break; }
          return { ok: false, error: `${label(key)} cannot be blank.` };
        }
        if (typeof raw !== 'string' || !validDate(raw)) {
          return { ok: false, error: `${label(key)} must be a date (YYYY-MM-DD).` };
        }
        data[key] = raw;
        break;
      }
      case 'month': {
        // Accepts 'YYYY-MM' or 'YYYY-MM-DD' and always stores the 1st of that month.
        if (typeof raw !== 'string') return { ok: false, error: 'Month is required.' };
        const m = /^(\d{4}-\d{2})(?:-\d{2})?$/.exec(raw.trim());
        if (!m || !validDate(`${m[1]}-01`)) return { ok: false, error: 'Month must look like 2026-12.' };
        data[key] = `${m[1]}-01`;
        break;
      }
    }
  }

  return { ok: true, data };
}

// ── Schemas (field names match supabase/migration_snail_mail.sql) ──

export const SUBSCRIBER_SCHEMA: Schema = {
  name:            { kind: 'text', max: 120 },
  email:           { kind: 'text', max: 200, nullable: true, format: 'email' },
  phone:           { kind: 'text', max: 40,  nullable: true },
  address_line1:   { kind: 'text', max: 200 },
  address_line2:   { kind: 'text', max: 200, nullable: true },
  city:            { kind: 'text', max: 100, nullable: true },
  state_region:    { kind: 'text', max: 100, nullable: true },
  postal_code:     { kind: 'text', max: 30,  nullable: true },
  country:         { kind: 'text', max: 100 },
  status:          { kind: 'enum', values: SUBSCRIBER_STATUSES },
  price_per_issue: { kind: 'number', min: 0, max: 10000 },
  source:          { kind: 'text', max: 100, nullable: true },
  notes:           { kind: 'text', max: 2000, nullable: true },
  joined_on:       { kind: 'date' },
  plan_id:          { kind: 'uuid', nullable: true },
  preferred_method: { kind: 'enum', values: PAYMENT_METHODS, nullable: true },
};
export const SUBSCRIBER_REQUIRED = ['name', 'address_line1'];

export const ISSUE_SCHEMA: Schema = {
  issue_month:    { kind: 'month' },
  city:           { kind: 'text', max: 120 },
  country:        { kind: 'text', max: 120, nullable: true },
  title:          { kind: 'text', max: 160, nullable: true },
  highlights:     { kind: 'text', max: 5000, nullable: true },
  story:          { kind: 'text', max: 10000, nullable: true },
  status:         { kind: 'enum', values: ISSUE_STATUSES },
  is_published:   { kind: 'bool' },
  print_cost:     { kind: 'number', min: 0, max: 1000 },
  postage_local:  { kind: 'number', min: 0, max: 1000 },
  postage_intl:   { kind: 'number', min: 0, max: 1000 },
  packaging_cost: { kind: 'number', min: 0, max: 1000 },
  notes:          { kind: 'text', max: 2000, nullable: true },
};
export const ISSUE_REQUIRED = ['issue_month', 'city'];

export const SHIPMENT_SCHEMA: Schema = {
  status:         { kind: 'enum', values: SHIPMENT_STATUSES },
  mailed_on:      { kind: 'date', nullable: true },
  tracking_ref:   { kind: 'text', max: 120, nullable: true },
  price_charged:  { kind: 'number', min: 0, max: 10000 },
  print_cost:     { kind: 'number', min: 0, max: 1000 },
  postage_cost:   { kind: 'number', min: 0, max: 1000 },
  packaging_cost: { kind: 'number', min: 0, max: 1000 },
  notes:          { kind: 'text', max: 2000, nullable: true },
};

// ── Payments and plans (field names match supabase/migration_payments.sql and migration_custom_plans.sql) ──
// `subscriber_id` is checked separately (it must be a real UUID); it can only be set on create.
export const PAYMENT_SCHEMA: Schema = {
  paid_on:      { kind: 'date' },
  method:       { kind: 'enum', values: PAYMENT_METHODS },
  plan_months:  { kind: 'int',  min: 1, max: 120 },
  plan_id:      { kind: 'uuid', nullable: true },
  period_start: { kind: 'month' },
  amount:       { kind: 'number', min: 0, max: 1000000 },
  currency:     { kind: 'text', max: 3, format: 'currency' },
  amount_sgd:   { kind: 'number', min: 0, max: 1000000 },
  reference:    { kind: 'text', max: 120, nullable: true },
  status:       { kind: 'enum', values: PAYMENT_STATUSES },
  notes:        { kind: 'text', max: 2000, nullable: true },
};
export const PAYMENT_REQUIRED = ['paid_on', 'method', 'plan_months', 'period_start', 'amount'];

/** After creation only these can change; the plan, period and subscriber are fixed (delete and re-add to change them). */
export const PAYMENT_EDIT_FIELDS = ['paid_on', 'method', 'amount', 'currency', 'amount_sgd', 'reference', 'status', 'notes'] as const;

export const PLAN_SCHEMA: Schema = {
  name:             { kind: 'text', max: 60 },
  months:           { kind: 'int', min: 1, max: 120 },
  price:            { kind: 'number', min: 0, max: 100000, nullable: true },
  is_active:        { kind: 'bool' },
  is_complimentary: { kind: 'bool' },
};
export const PLAN_REQUIRED = ['name', 'months'];

/** Row ids come from the URL; make sure they really are UUIDs before querying. */
export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** True when a table does not exist yet (Postgres says 42P01; the Supabase REST layer says PGRST205). */
export function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205';
}

/** True when a column does not exist yet (Postgres 42703; PostgREST PGRST204 for writes). */
export function isMissingColumn(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === '42703' || code === 'PGRST204';
}

/** Turns a Postgres/PostgREST error into a message that is safe and useful to show. */
export function friendlyDbError(err: { code?: string; message?: string }): { message: string; status: number } {
  switch (err.code) {
    case '23505': return { message: 'That already exists (duplicate). Plan names must be different from each other.', status: 409 };
    case '23001': // ON DELETE RESTRICT
    case '23503': return { message: 'This is linked to other records (for example shipments, payments or subscribers), or points at something that does not exist.', status: 409 };
    case '23514': return { message: 'One of the values is outside the allowed range.', status: 400 };
    case '42P01':
    case 'PGRST205': return { message: 'A snail mail table is missing. In the Supabase SQL Editor, run supabase/migration_snail_mail.sql, then migration_payments.sql, then migration_custom_plans.sql.', status: 500 };
    case '42703':
    case 'PGRST204': return { message: 'The database is missing a column. In the Supabase SQL Editor, run supabase/migration_custom_plans.sql (after migration_payments.sql), then try again.', status: 500 };
    default:      return { message: 'Database error.', status: 500 };
  }
}
