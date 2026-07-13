import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/supabase-admin";

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// POST /api/artworks/upload — multipart: file, artworkId, sortOrder (0..2)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const artworkId = String(form.get("artworkId") ?? "").trim();
    const sortOrder = Number(form.get("sortOrder") ?? 0);

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!artworkId) return NextResponse.json({ error: "Missing artworkId" }, { status: 400 });
    if (!EXT[file.type]) {
      return NextResponse.json({ error: "Only JPG, PNG, or WebP allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 8 MB" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const filename = `${artworkId}__slot${sortOrder}__${Date.now()}.${EXT[file.type]}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    // Upload the new file.
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, bytes, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
    const publicUrl = pub.publicUrl;

    // Replace any existing image already in this slot for the artwork.
    const { data: prev } = await supabase
      .from("artwork_images")
      .select("id, filename")
      .eq("artwork_id", artworkId)
      .eq("sort_order", sortOrder);

    for (const row of prev ?? []) {
      if (row.filename) {
        await supabase.storage.from(STORAGE_BUCKET).remove([row.filename]);
      }
      await supabase.from("artwork_images").delete().eq("id", row.id);
    }

    // Insert the new image row.
    const { data: inserted, error: insErr } = await supabase
      .from("artwork_images")
      .insert({
        artwork_id: artworkId,
        url: publicUrl,
        filename,
        caption: null,
        sort_order: sortOrder,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    // Keep the artwork's cached cover in sync when slot 0 changes.
    if (sortOrder === 0) {
      await supabase.from("artworks").update({ image_url: publicUrl }).eq("id", artworkId);
    }

    return NextResponse.json({ publicUrl, image: inserted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
