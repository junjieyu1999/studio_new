// POST /api/admin/mail/issues/[id]/generate
// Creates one pending shipment for every ACTIVE subscriber who does not already
// have one for this issue. Safe to run again after new subscribers join.
//
// Optional body { only_paid: true } skips active subscribers who have not paid for this issue's
// month (free subscribers, price 0, always count as paid). Without it everyone active is included,
// and the response says how many of them were unpaid so the admin can warn about it.
//
// Each shipment gets a snapshot of the price and costs at this moment:
//   price_charged  <- the subscriber's price_per_issue
//   print_cost     <- the issue's print_cost
//   postage_cost   <- the issue's postage_local (Singapore) or postage_intl
//   packaging_cost <- the issue's packaging_cost
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { isUuid, friendlyDbError, isMissingTable, isMissingColumn } from '@/lib/mail-validation';
import { isLocalCountry, type MailPayment } from '@/lib/mail';
import { paymentCovers } from '@/lib/mail-payments';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  const onlyPaid = ((await req.json().catch(() => null)) as { only_paid?: unknown } | null)?.only_paid === true;

  try {
    const admin = getAdminClient();

    const { data: issue, error: issueErr } = await admin
      .from('mail_issues')
      .select('id, issue_month, print_cost, postage_local, postage_intl, packaging_cost')
      .eq('id', id)
      .maybeSingle();
    if (issueErr) {
      const f = friendlyDbError(issueErr);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    // Read active subscribers in pages (Supabase caps a single response at 1000 rows).
    const subscribers: { id: string; country: string; price_per_issue: number }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('mail_subscribers')
        .select('id, country, price_per_issue')
        .eq('status', 'active')
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) {
        const f = friendlyDbError(error);
        return NextResponse.json({ error: f.message }, { status: f.status });
      }
      subscribers.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    if (subscribers.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, unpaid: 0, message: 'There are no active subscribers.' });
    }

    // Who has paid for this issue's month? Needs migration_payments.sql; without it nobody is flagged.
    const issueYm = String(issue.issue_month).slice(0, 7);
    const paidIds = new Set<string>();
    let paymentsReady = true;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('mail_payments')
        .select('subscriber_id, plan_months, period_start, status')
        .eq('status', 'received')
        .lte('period_start', `${issueYm}-01`)
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) {
        if (isMissingTable(error)) { paymentsReady = false; break; }
        const f = friendlyDbError(error);
        return NextResponse.json({ error: f.message }, { status: f.status });
      }
      for (const p of (data ?? []) as MailPayment[]) {
        if (paymentCovers(p, issueYm)) paidIds.add(p.subscriber_id);
      }
      if (!data || data.length < 1000) break;
    }
    if (onlyPaid && !paymentsReady) {
      return NextResponse.json({ error: 'Payment tracking is not set up yet. Run supabase/migration_payments.sql first.' }, { status: 400 });
    }

    // Subscribers on a "no payment needed" plan (Friends & family) never count as unpaid.
    // Needs migration_custom_plans.sql; before it there are no such plans, so nobody is added.
    const complimentaryIds = new Set<string>();
    if (paymentsReady) {
      const { data: cps, error: cpErr } = await admin.from('mail_plans').select('id').eq('is_complimentary', true);
      if (cpErr && !isMissingColumn(cpErr)) {
        const f = friendlyDbError(cpErr);
        return NextResponse.json({ error: f.message }, { status: f.status });
      }
      const planIds = (cps ?? []).map((r: { id: string }) => r.id);
      if (!cpErr && planIds.length > 0) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await admin
            .from('mail_subscribers')
            .select('id')
            .in('plan_id', planIds)
            .order('id', { ascending: true })
            .range(from, from + 999);
          if (error) {
            const f = friendlyDbError(error);
            return NextResponse.json({ error: f.message }, { status: f.status });
          }
          for (const r of data ?? []) complimentaryIds.add(r.id as string);
          if (!data || data.length < 1000) break;
        }
      }
    }
    const isPaid = (s: { id: string; price_per_issue: number }) =>
      Number(s.price_per_issue) === 0 || complimentaryIds.has(s.id) || paidIds.has(s.id);
    const unpaid = paymentsReady ? subscribers.filter((s) => !isPaid(s)).length : 0;
    const included = onlyPaid ? subscribers.filter(isPaid) : subscribers;

    if (included.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, unpaid, message: 'Nobody who is active has paid for this month.' });
    }

    const rows = included.map((s) => ({
      issue_id: issue.id,
      subscriber_id: s.id,
      price_charged: s.price_per_issue,
      print_cost: issue.print_cost,
      postage_cost: isLocalCountry(s.country) ? issue.postage_local : issue.postage_intl,
      packaging_cost: issue.packaging_cost,
    }));

    let created = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await admin
        .from('mail_shipments')
        .upsert(rows.slice(i, i + 500), { onConflict: 'issue_id,subscriber_id', ignoreDuplicates: true })
        .select('id');
      if (error) {
        console.error('generate shipments error:', error);
        const f = friendlyDbError(error);
        return NextResponse.json({ error: f.message }, { status: f.status });
      }
      created += data?.length ?? 0;
    }

    return NextResponse.json({ created, skipped: rows.length - created, unpaid, left_out: onlyPaid ? subscribers.length - included.length : 0 });
  } catch (err) {
    console.error('generate shipments error:', err);
    return NextResponse.json({ error: 'Could not create shipments.' }, { status: 500 });
  }
}
