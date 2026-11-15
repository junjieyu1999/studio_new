// POST /api/admin/mail/issues/[id]/generate
// Creates one pending shipment for every ACTIVE subscriber who does not already
// have one for this issue. Safe to run again after new subscribers join.
//
// Each shipment gets a snapshot of the price and costs at this moment:
//   price_charged  <- the subscriber's price_per_issue
//   print_cost     <- the issue's print_cost
//   postage_cost   <- the issue's postage_local (Singapore) or postage_intl
//   packaging_cost <- the issue's packaging_cost
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { isUuid, friendlyDbError } from '@/lib/mail-validation';
import { isLocalCountry } from '@/lib/mail';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    const admin = getAdminClient();

    const { data: issue, error: issueErr } = await admin
      .from('mail_issues')
      .select('id, print_cost, postage_local, postage_intl, packaging_cost')
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
      return NextResponse.json({ created: 0, skipped: 0, message: 'There are no active subscribers.' });
    }

    const rows = subscribers.map((s) => ({
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

    return NextResponse.json({ created, skipped: rows.length - created });
  } catch (err) {
    console.error('generate shipments error:', err);
    return NextResponse.json({ error: 'Could not create shipments.' }, { status: 500 });
  }
}
