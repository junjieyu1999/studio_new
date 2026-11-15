// GET /api/admin/mail/data — everything the Snail mail admin needs in one call.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { friendlyDbError } from '@/lib/mail-validation';

const PAGE = 1000; // Supabase returns at most 1000 rows per request, so read in pages.

async function fetchAll(table: string, orderBy: string, ascending: boolean) {
  const admin = getAdminClient();
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
      .order('id', { ascending: true }) // stable tie-break so pages never overlap
      .range(from, from + PAGE - 1);
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
    return NextResponse.json(
      { subscribers, issues, shipments },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET mail data error:', err);
    const f = friendlyDbError(err as { code?: string });
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
