import { getArtworks } from "@/lib/artworks";
import { GalleryMount } from "@/components/gallery/GalleryMount";

// Always read live from Supabase so admin edits show up immediately instead of
// being frozen into a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function Home() {
  const artworks = await getArtworks();
  return <GalleryMount artworks={artworks} />;
}
