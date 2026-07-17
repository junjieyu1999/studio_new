import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/supabase-admin";
import { toPrice } from "@/lib/price";

const STATUSES = ["available", "sold", "in-progress"];
const THEMES = ["portrait", "landscape"];

// PATCH /api/artworks/[id] — update editable fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.year === "string") update.year = body.year;
    if (typeof body.medium === "string") update.medium = body.medium;
    if (typeof body.dimensions === "string") update.dimensions = body.dimensions;
    if (STATUSES.includes(body.status)) update.status = body.status;
    if (THEMES.includes(body.theme)) update.theme = body.theme;
    if ("description" in body) update.description = body.description || null;
    if ("inspiration" in body) update.inspiration = body.inspiration || null;
    if ("process" in body) update.process = body.process || null;
    if ("price" in body) update.price = toPrice(body.price);
    if ("gradient_bg" in body) update.gradient_bg = body.gradient_bg || null;
    if ("sort_order" in body) update.sort_order = Number(body.sort_order) || 0;

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("artworks")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ artwork: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update artwork";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/artworks/[id] — delete artwork + its stored images
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    // Remove image files from storage first (rows cascade-delete with artwork).
    const { data: images } = await supabase
      .from("artwork_images")
      .select("filename")
      .eq("artwork_id", id);

    const filenames = (images ?? [])
      .map((i) => i.filename)
      .filter((f): f is string => Boolean(f));
    if (filenames.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(filenames);
    }

    const { error } = await supabase.from("artworks").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete artwork";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
