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
} from './mail';

type Rule =
  | { kind: 'text'; max: number; nullable?: boolean; format?: 'email' | 'slug' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'number'; min: number; max: number }
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
        data[key] = v;
        break;
      }
      case 'enum': {
        if (typeof raw !== 'string' || !rule.values.includes(raw)) {
          return { ok: false, error: `${label(key)} must be one of: ${rule.values.join(', ')}.` };
        }
        data[key] = raw;
        break;
      }
      case 'number': {
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

/** Row ids come from the URL; make sure they really are UUIDs before querying. */
export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Turns a Postgres/PostgREST error into a message that is safe and useful to show. */
export function friendlyDbError(err: { code?: string; message?: string }): { message: string; status: number } {
  switch (err.code) {
    case '23505': return { message: 'That already exists (duplicate).', status: 409 };
    case '23001': // ON DELETE RESTRICT
    case '23503': return { message: 'This is linked to other records (for example shipments), or points at something that does not exist.', status: 409 };
    case '23514': return { message: 'One of the values is outside the allowed range.', status: 400 };
    case '42P01': return { message: 'The snail mail tables are missing. Run supabase/migration_snail_mail.sql in the Supabase SQL Editor.', status: 500 };
    default:      return { message: 'Database error.', status: 500 };
  }
}
