import { getArtworks } from "@/lib/artworks";
import { GalleryCanvas } from "@/components/gallery/GalleryCanvas";

// Always read live from Supabase so admin edits show up immediately instead of
// being frozen into a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function Home() {
  const artworks = await getArtworks();
  return <GalleryCanvas artworks={artworks} />;
}
