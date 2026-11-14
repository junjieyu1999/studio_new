// POST /api/admin/mail/issues/[id]/bulk  body: { to: 'printed' | 'mailed' }
// Moves this issue's shipments forward in one go:
//   to 'printed' -> every PENDING shipment becomes printed
//   to 'mailed'  -> every PENDING or PRINTED shipment becomes mailed (mailed_on = today, Singapore time)
// Shipments that are already mailed / delivered / returned are never touched.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { isUuid, friendlyDbError } from '@/lib/mail-validation';
import { todaySG } from '@/lib/mail';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const to = body && typeof body === 'object' ? (body as { to?: unknown }).to : undefined;
  if (to !== 'printed' && to !== 'mailed') {
    return NextResponse.json({ error: "'to' must be 'printed' or 'mailed'." }, { status: 400 });
  }

  try {
    const patch = to === 'mailed' ? { status: 'mailed', mailed_on: todaySG() } : { status: 'printed' };
    const from = to === 'mailed' ? ['pending', 'printed'] : ['pending'];

    const { data, error } = await getAdminClient()
      .from('mail_shipments')
      .update(patch)
      .eq('issue_id', id)
      .in('status', from)
      .select('id');
    if (error) {
      console.error('bulk shipments error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (err) {
    console.error('bulk shipments error:', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}
