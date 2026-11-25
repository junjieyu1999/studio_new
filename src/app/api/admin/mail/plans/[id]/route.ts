// PATCH  /api/admin/mail/plans/[id] — rename a plan, change its length or price, switch it on/off,
//                                     or mark it "no payment needed".
// DELETE /api/admin/mail/plans/[id] — remove a plan nobody uses (otherwise hide it with is_active).
//
// Changing a plan never rewrites past payments: each payment keeps the number of months it covered.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { parseBody, PLAN_SCHEMA, friendlyDbError, isUuid } from '@/lib/mail-validation';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });

  const parsed = parseBody(await req.json().catch(() => null), PLAN_SCHEMA);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const { data, error } = await getAdminClient()
      .from('mail_plans')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('PATCH plan error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('PATCH plan error:', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });

  try {
    const admin = getAdminClient();
    const [subs, pays] = await Promise.all([
      admin.from('mail_subscribers').select('id').eq('plan_id', id),
      admin.from('mail_payments').select('id').eq('plan_id', id),
    ]);
    if (subs.error) throw subs.error;
    if (pays.error) throw pays.error;
    const nSubs = subs.data?.length ?? 0;
    const nPays = pays.data?.length ?? 0;
    if (nSubs > 0 || nPays > 0) {
      const used = [nSubs > 0 ? `${nSubs} subscriber${nSubs === 1 ? '' : 's'}` : '', nPays > 0 ? `${nPays} payment${nPays === 1 ? '' : 's'}` : '']
        .filter(Boolean).join(' and ');
      return NextResponse.json(
        { error: `This plan is used by ${used}, so it cannot be deleted. Untick "Offered" to hide it instead.` },
        { status: 409 }
      );
    }

    const { data, error } = await admin.from('mail_plans').delete().eq('id', id).select('id');
    if (error) {
      console.error('DELETE plan error:', error);
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE plan error:', err);
    const f = friendlyDbError(err as { code?: string });
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
