import { notFound } from "next/navigation";
import { getArtworkById } from "@/lib/artworks";
import { ArtworkDetail } from "@/components/gallery/ArtworkDetail";

// Read live from Supabase on every request so edits appear immediately.
export const dynamic = "force-dynamic";

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
