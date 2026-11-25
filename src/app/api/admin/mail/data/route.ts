// GET /api/admin/mail/data — everything the Snail mail admin needs in one call.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { friendlyDbError, isMissingTable } from '@/lib/mail-validation';

const PAGE = 1000; // Supabase returns at most 1000 rows per request, so read in pages.

// `tieBreak` is a unique column used to keep page boundaries stable when many rows share the same
// `orderBy` value. Pass null for a table whose `orderBy` column is already unique (mail_plans has
// no `id`: its key is `months`).
async function fetchAll(table: string, orderBy: string, ascending: boolean, tieBreak: string | null = 'id') {
  const admin = getAdminClient();
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = admin.from(table).select('*').order(orderBy, { ascending });
    if (tieBreak) q = q.order(tieBreak, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const [subscribers, issues, shipments] = await Promise.all([
      fetchAll('mail_subscribers', 'created_at', false),
      fetchAll('mail_issues', 'issue_month', false),
      fetchAll('mail_shipments', 'created_at', true),
    ]);

    // Payments are newer than the rest. If migration_payments.sql has not been run yet, keep the
    // whole Snail mail tab working and just tell the screen to show a "run the migration" notice.
    let payments: unknown[] = [];
    let plans: unknown[] = [];
    let paymentsSetupNeeded = false;
    try {
      [payments, plans] = await Promise.all([
        fetchAll('mail_payments', 'paid_on', false),
        fetchAll('mail_plans', 'months', true, null),
      ]);
    } catch (err) {
      if (isMissingTable(err)) paymentsSetupNeeded = true;
      else throw err;
    }

    // migration_custom_plans.sql gives every plan an id. Plans without one mean it has not been run
    // yet, so show the same "run the migration" notice instead of a half-working screen.
    if (!paymentsSetupNeeded && plans.some((p) => !(p as { id?: unknown }).id)) {
      payments = [];
      plans = [];
      paymentsSetupNeeded = true;
    }

    return NextResponse.json(
      { subscribers, issues, shipments, payments, plans, paymentsSetupNeeded },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET mail data error:', err);
    const f = friendlyDbError(err as { code?: string });
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
