// PATCH  /api/admin/mail/shipments/[id] — update status, tracking, notes or costs
// DELETE /api/admin/mail/shipments/[id] — remove a shipment row
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, SHIPMENT_SCHEMA, isUuid, friendlyDbError } from '@/lib/mail-validation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const parsed = parseBody(await req.json().catch(() => null), SHIPMENT_SCHEMA);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const { data, error } = await getAdminClient()
      .from('mail_shipments')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('PATCH shipment error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data) return NextResponse.json({ error: 'Shipment not found.' }, { status: 404 });
    return NextResponse.json({ shipment: data });
  } catch (err) {
    console.error('PATCH shipment error:', err);
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
      .from('mail_shipments')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      console.error('DELETE shipment error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: 'Shipment not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE shipment error:', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
