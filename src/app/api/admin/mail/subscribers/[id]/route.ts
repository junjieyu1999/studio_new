// PATCH  /api/admin/mail/subscribers/[id] — edit a subscriber
// DELETE /api/admin/mail/subscribers/[id] — delete (blocked if they have shipment history)
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, SUBSCRIBER_SCHEMA, isUuid, friendlyDbError } from '@/lib/mail-validation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const parsed = parseBody(await req.json().catch(() => null), SUBSCRIBER_SCHEMA);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const { data, error } = await getAdminClient()
      .from('mail_subscribers')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('PATCH subscriber error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data) return NextResponse.json({ error: 'Subscriber not found.' }, { status: 404 });
    return NextResponse.json({ subscriber: data });
  } catch (err) {
    console.error('PATCH subscriber error:', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    const { data, error } = await getAdminClient()
      .from('mail_subscribers')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      console.error('DELETE subscriber error:', error);
      if (error.code === '23001' || error.code === '23503') { // 23001 = ON DELETE RESTRICT
        return NextResponse.json(
          { error: 'This subscriber has shipment or payment history, so it cannot be deleted. Set their status to Cancelled instead.' },
          { status: 409 }
        );
      }
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: 'Subscriber not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE subscriber error:', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
