import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockArtworkImages, mockArtworks } from "@/lib/mock-data";
import { Artwork, ArtworkImage, ArtworkWithImages } from "@/types/artwork";

export async function getArtworks(): Promise<Artwork[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [...mockArtworks].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch artworks from Supabase:", error.message);
    return [...mockArtworks].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  return data as Artwork[];
}

export async function getArtworkById(
  id: string
): Promise<ArtworkWithImages | null> {
  if (!isSupabaseConfigured || !supabase) {
    const artwork = mockArtworks.find((a) => a.id === id);
    if (!artwork) return null;
    const images = mockArtworkImages
      .filter((img) => img.artwork_id === id)
      .sort((a, b) => a.sort_order - b.sort_order);
    return { ...artwork, images };
  }

  const [{ data: artwork, error: artworkError }, { data: images, error: imagesError }] =
    await Promise.all([
      supabase.from("artworks").select("*").eq("id", id).single(),
      supabase
        .from("artwork_images")
        .select("*")
        .eq("artwork_id", id)
        .order("sort_order", { ascending: true }),
    ]);

  if (artworkError || !artwork) {
    if (artworkError) {
      console.error("Failed to fetch artwork from Supabase:", artworkError.message);
    }
    return null;
  }

  if (imagesError) {
    console.error("Failed to fetch artwork images from Supabase:", imagesError.message);
  }

  return {
    ...(artwork as Artwork),
    images: (images as ArtworkImage[]) ?? [],
  };
}
