import { notFound } from "next/navigation";
import { getArtworkById } from "@/lib/artworks";
import { ArtworkDetail } from "@/components/gallery/ArtworkDetail";

export default async function ArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artwork = await getArtworkById(id);

  if (!artwork) notFound();

  return <ArtworkDetail artwork={artwork} />;
}
