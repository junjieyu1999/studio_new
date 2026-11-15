// POST /api/admin/mail/issues — create a monthly issue.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, ISSUE_SCHEMA, ISSUE_REQUIRED, friendlyDbError } from '@/lib/mail-validation';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = parseBody(await req.json().catch(() => null), ISSUE_SCHEMA, ISSUE_REQUIRED);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data, error } = await getAdminClient()
      .from('mail_issues')
      .insert(parsed.data)
      .select()
      .single();
    if (error) {
      console.error('POST issue error:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'There is already an issue for that month.' }, { status: 409 });
      }
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    return NextResponse.json({ issue: data });
  } catch (err) {
    console.error('POST issue error:', err);
    return NextResponse.json({ error: 'Create failed.' }, { status: 500 });
  }
}
