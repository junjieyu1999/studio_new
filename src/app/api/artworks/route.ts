import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { toPrice } from "@/lib/price";

const STATUSES = ["available", "sold", "in-progress"];
const THEMES = ["portrait", "landscape"];

// GET /api/artworks — list all artworks (admin view, service role)
export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("artworks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load artworks";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/artworks — create a new artwork
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    const title = String(body.title ?? "").trim();

    if (!id) return NextResponse.json({ error: "ID / slug is required" }, { status: 400 });
    if (!/^[a-z0-9-]+$/.test(id)) {
      return NextResponse.json(
        { error: "ID may only contain lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const status = STATUSES.includes(body.status) ? body.status : "available";
    const theme = THEMES.includes(body.theme) ? body.theme : "portrait";

    const supabase = getAdminClient();

    const { data: existing } = await supabase
      .from("artworks")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: `An artwork with id "${id}" already exists` },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("artworks")
      .insert({
        id,
        title,
        year: String(body.year ?? ""),
        medium: String(body.medium ?? ""),
        dimensions: String(body.dimensions ?? ""),
        status,
        theme,
        description: body.description || null,
        inspiration: body.inspiration || null,
        process: body.process || null,
        price: toPrice(body.price),
        gradient_bg: body.gradient_bg || null,
        image_url: null,
        sort_order: Number(body.sort_order) || 0,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ artwork: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create artwork";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
