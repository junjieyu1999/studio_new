// PATCH /api/admin/mail/plans/[months] — set the price of a plan (3, 6 or 12 months)
// or switch it on/off. Plans themselves cannot be added or removed.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, PLAN_SCHEMA, friendlyDbError } from '@/lib/mail-validation';
import { PLAN_MONTHS } from '@/lib/mail';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ months: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { months } = await params;
  const m = Number(months);
  if (!(PLAN_MONTHS as readonly number[]).includes(m)) {
    return NextResponse.json({ error: 'Plans are 3, 6 or 12 months.' }, { status: 400 });
  }

  const parsed = parseBody(await req.json().catch(() => null), PLAN_SCHEMA);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const { data, error } = await getAdminClient()
      .from('mail_plans')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('months', m)
      .select()
      .maybeSingle();
    if (error) {
      console.error('PATCH plan error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data) return NextResponse.json({ error: 'Plan not found. Run supabase/migration_payments.sql.' }, { status: 404 });
    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('PATCH plan error:', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}
