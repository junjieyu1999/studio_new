import { getArtworks } from "@/lib/artworks";
import { GalleryCanvas } from "@/components/gallery/GalleryCanvas";

export default async function Home() {
  const artworks = await getArtworks();
  return <GalleryCanvas artworks={artworks} />;
}
