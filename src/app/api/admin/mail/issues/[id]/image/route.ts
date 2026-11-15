// POST   /api/admin/mail/issues/[id]/image — upload (or replace) the postcard design.
//                                            multipart/form-data with one field: "file"
// DELETE /api/admin/mail/issues/[id]/image — remove it
//
// Postcard designs are their own collection. They live under "postcards/" in the
// storage bucket and on the issue row — never in the artworks table — so they
// can't show up among your oil paintings.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/mail-validation';

// Vercel rejects request bodies over ~4.5 MB before they reach this code, so
// stop a little under that and give a readable message instead.
const MAX_BYTES = 4 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Check the file really is what it claims to be, not just what its name says. */
function looksLike(type: string, b: Buffer): boolean {
  if (type === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/webp') return b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (!EXT[file.type]) return NextResponse.json({ error: 'Only JPG, PNG or WebP images are allowed.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That image is over 4 MB. Please export a smaller one.' }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLike(file.type, bytes)) {
    return NextResponse.json({ error: 'That file is not a valid image.' }, { status: 400 });
  }

  try {
    const admin = getAdminClient();
    const { data: issue, error: findErr } = await admin
      .from('mail_issues').select('id, image_path').eq('id', id).maybeSingle();
    if (findErr) throw findErr;
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    const path = `postcards/${id}__${Date.now()}.${EXT[file.type]}`;
    const { error: upErr } = await admin.storage
      .from(STORAGE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    const { data: updated, error: updErr } = await admin
      .from('mail_issues')
      .update({ image_url: pub.publicUrl, image_path: path })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (updErr || !updated) {
      // The row didn't take the new image, so don't leave an orphan file behind.
      await admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => {});
      if (updErr) throw updErr;
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }

    // Replaced: tidy up the previous file (best effort; a leftover file is harmless).
    if (issue.image_path && issue.image_path !== path) {
      await admin.storage.from(STORAGE_BUCKET).remove([issue.image_path]).catch(() => {});
    }
    return NextResponse.json({ issue: updated });
  } catch (err) {
    console.error('POST issue image error:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    const admin = getAdminClient();
    const { data: issue, error: findErr } = await admin
      .from('mail_issues').select('id, image_path').eq('id', id).maybeSingle();
    if (findErr) throw findErr;
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    const { data: updated, error: updErr } = await admin
      .from('mail_issues')
      .update({ image_url: null, image_path: null })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (updErr) throw updErr;

    if (issue.image_path) {
      await admin.storage.from(STORAGE_BUCKET).remove([issue.image_path]).catch(() => {});
    }
    return NextResponse.json({ issue: updated });
  } catch (err) {
    console.error('DELETE issue image error:', err);
    return NextResponse.json({ error: 'Could not remove the image.' }, { status: 500 });
  }
}
