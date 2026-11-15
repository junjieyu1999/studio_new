// PATCH  /api/admin/mail/issues/[id] — edit an issue
// DELETE /api/admin/mail/issues/[id] — delete (blocked if shipments exist)
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase-admin';
import { parseBody, ISSUE_SCHEMA, isUuid, friendlyDbError } from '@/lib/mail-validation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const parsed = parseBody(await req.json().catch(() => null), ISSUE_SCHEMA);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const { data, error } = await getAdminClient()
      .from('mail_issues')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('PATCH issue error:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'There is already an issue for that month.' }, { status: 409 });
      }
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    return NextResponse.json({ issue: data });
  } catch (err) {
    console.error('PATCH issue error:', err);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    const admin = getAdminClient();
    const { data: existing } = await admin.from('mail_issues').select('image_path').eq('id', id).maybeSingle();
    const { data, error } = await admin
      .from('mail_issues')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      console.error('DELETE issue error:', error);
      if (error.code === '23001' || error.code === '23503') { // 23001 = ON DELETE RESTRICT
        return NextResponse.json(
          { error: 'This issue has shipments. Delete those shipments first if you really want to remove the issue.' },
          { status: 409 }
        );
      }
      const f = friendlyDbError(error);
      return NextResponse.json({ error: f.message }, { status: f.status });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    // The issue is gone, so remove its design file too (best effort).
    if (existing?.image_path) {
      await admin.storage.from(STORAGE_BUCKET).remove([existing.image_path]).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE issue error:', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
