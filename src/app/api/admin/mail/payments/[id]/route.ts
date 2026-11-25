// PATCH  /api/admin/mail/payments/[id] — fix details, or mark a payment refunded
// DELETE /api/admin/mail/payments/[id] — remove a payment recorded by mistake
//
// The subscriber, plan and months covered cannot be edited. If those are wrong, delete the
// payment and record it again, so the history never quietly rewrites itself.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, PAYMENT_SCHEMA, PAYMENT_EDIT_FIELDS, isUuid, friendlyDbError, type Schema } from '@/lib/mail-validation';

const EDIT_SCHEMA: Schema = Object.fromEntries(
  PAYMENT_EDIT_FIELDS.map((k) => [k, PAYMENT_SCHEMA[k]])
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const parsed = parseBody(await req.json().catch(() => null), EDIT_SCHEMA);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const admin = getAdminClient();
    const { data: current, error: findErr } = await admin
      .from('mail_payments').select('amount, currency, amount_sgd').eq('id', id).maybeSingle();
    if (findErr) throw findErr;
    if (!current) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });

    // Keep the S$ value consistent with the amount and currency.
    const d = parsed.data;
    const currency = (d.currency as string | undefined) ?? (current.currency as string);
    const amount = (d.amount as number | undefined) ?? Number(current.amount);
    if (currency === 'SGD') {
      d.amount_sgd = amount;
    } else if (d.amount_sgd === undefined && (d.currency !== undefined || d.amount !== undefined)) {
      return NextResponse.json({ error: `Enter what the ${currency} payment is worth in S$.` }, { status: 400 });
    }

    const { data, error } = await admin
      .from('mail_payments')
      .update(d)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('PATCH payment error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    return NextResponse.json({ payment: data });
  } catch (err) {
    console.error('PATCH payment error:', err);
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
      .from('mail_payments')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      console.error('DELETE payment error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE payment error:', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
