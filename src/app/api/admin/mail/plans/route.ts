// POST /api/admin/mail/plans — add a plan (for example "Friends & family", or a 24-month plan).
// Plans appear in the same dropdowns as the 3, 6 and 12 month ones.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, PLAN_SCHEMA, PLAN_REQUIRED, friendlyDbError } from '@/lib/mail-validation';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = parseBody(await req.json().catch(() => null), PLAN_SCHEMA, PLAN_REQUIRED);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data, error } = await getAdminClient()
      .from('mail_plans')
      .insert(parsed.data)
      .select()
      .single();
    if (error) {
      console.error('POST plan error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('POST plan error:', err);
    return NextResponse.json({ error: 'Could not add the plan.' }, { status: 500 });
  }
}
