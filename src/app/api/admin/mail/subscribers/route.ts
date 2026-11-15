// POST /api/admin/mail/subscribers — add a subscriber.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, SUBSCRIBER_SCHEMA, SUBSCRIBER_REQUIRED, friendlyDbError } from '@/lib/mail-validation';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = parseBody(await req.json().catch(() => null), SUBSCRIBER_SCHEMA, SUBSCRIBER_REQUIRED);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data, error } = await getAdminClient()
      .from('mail_subscribers')
      .insert(parsed.data)
      .select()
      .single();
    if (error) {
      console.error('POST subscriber error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    return NextResponse.json({ subscriber: data });
  } catch (err) {
    console.error('POST subscriber error:', err);
    return NextResponse.json({ error: 'Create failed.' }, { status: 500 });
  }
}
