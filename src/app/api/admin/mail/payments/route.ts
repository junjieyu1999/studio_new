// POST /api/admin/mail/payments — record a payment from a subscriber.
//
// A payment covers `plan_months` months starting at `period_start`. `plan_id` says which plan it was
// recorded under (omit or null for a one-off "Custom" length); `plan_months` is what counts.
// A payment covers `plan_months` months starting at `period_start`. If those months overlap
// months the subscriber has already paid for, the request is refused (409) unless the caller
// sends `confirm_overlap: true`, so a payment is never double-counted by accident.
//
// For a payment in a foreign currency (for example USD into Revolut) `amount_sgd` is what it is
// worth to you in S$ and is required. For SGD it is simply the amount.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, PAYMENT_SCHEMA, PAYMENT_REQUIRED, isUuid, friendlyDbError } from '@/lib/mail-validation';
import { overlappingMonths } from '@/lib/mail-payments';
import { formatMonth, type MailPayment } from '@/lib/mail';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const subscriberId = (body as { subscriber_id?: unknown } | null)?.subscriber_id;
  if (typeof subscriberId !== 'string' || !isUuid(subscriberId)) {
    return NextResponse.json({ error: 'Choose a subscriber.' }, { status: 400 });
  }
  const confirmOverlap = (body as { confirm_overlap?: unknown }).confirm_overlap === true;

  const parsed = parseBody(body, PAYMENT_SCHEMA, PAYMENT_REQUIRED);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  // SGD needs no conversion. Any other currency must say what it is worth in S$.
  const currency = (d.currency as string | undefined) ?? 'SGD';
  d.currency = currency;
  if (currency === 'SGD') {
    d.amount_sgd = d.amount;
  } else if (d.amount_sgd === undefined) {
    return NextResponse.json({ error: `Enter what the ${currency} payment is worth in S$.` }, { status: 400 });
  }
  if ((d.status as string | undefined) === 'refunded') {
    return NextResponse.json({ error: 'Record the payment first; you can mark it refunded afterwards.' }, { status: 400 });
  }

  try {
    const admin = getAdminClient();

    const { data: sub, error: subErr } = await admin
      .from('mail_subscribers').select('id').eq('id', subscriberId).maybeSingle();
    if (subErr) throw subErr;
    if (!sub) return NextResponse.json({ error: 'Subscriber not found.' }, { status: 404 });

    if (typeof d.plan_id === 'string') {
      const { data: plan, error: planErr } = await admin
        .from('mail_plans').select('id').eq('id', d.plan_id).maybeSingle();
      if (planErr) throw planErr;
      if (!plan) return NextResponse.json({ error: 'That plan no longer exists. Reload the page and choose again.' }, { status: 400 });
    }

    if (!confirmOverlap) {
      const { data: existing, error: exErr } = await admin
        .from('mail_payments')
        .select('id, subscriber_id, paid_on, method, plan_months, period_start, amount, currency, amount_sgd, reference, status, notes, created_at')
        .eq('subscriber_id', subscriberId)
        .eq('status', 'received');
      if (exErr) throw exErr;
      const clash = overlappingMonths((existing ?? []) as MailPayment[], (d.period_start as string).slice(0, 7), d.plan_months as number);
      if (clash.length > 0) {
        const names = clash.map((m) => formatMonth(`${m}-01`, 'short')).join(', ');
        return NextResponse.json(
          { error: `This overlaps months already paid for (${names}). Pick a later start month, or confirm to record it anyway.`, overlap: clash },
          { status: 409 }
        );
      }
    }

    const { data, error } = await admin
      .from('mail_payments')
      .insert({ ...d, subscriber_id: subscriberId })
      .select()
      .single();
    if (error) {
      console.error('POST payment error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    return NextResponse.json({ payment: data });
  } catch (err) {
    console.error('POST payment error:', err);
    const f = friendlyDbError(err as { code?: string });
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
