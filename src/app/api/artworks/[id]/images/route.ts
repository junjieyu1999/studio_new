import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/supabase-admin";

// GET /api/artworks/[id]/images — list images for an artwork
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("artwork_images")
      .select("*")
      .eq("artwork_id", id)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load images";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/artworks/[id]/images — remove one image { imageId, filename }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { imageId, filename } = await req.json();
    if (!imageId) {
      return NextResponse.json({ error: "imageId is required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Look up the row so we know whether it was the cover (slot 0).
    const { data: row } = await supabase
      .from("artwork_images")
      .select("sort_order, filename")
      .eq("id", imageId)
      .maybeSingle();

    const fileToRemove = filename || row?.filename;
    if (fileToRemove) {
      await supabase.storage.from(STORAGE_BUCKET).remove([fileToRemove]);
    }

    const { error } = await supabase
      .from("artwork_images")
      .delete()
      .eq("id", imageId);
    if (error) throw error;

    // If the cover was removed, clear the artwork's cached image_url.
    if (row?.sort_order === 0) {
      await supabase.from("artworks").update({ image_url: null }).eq("id", id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete image";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
