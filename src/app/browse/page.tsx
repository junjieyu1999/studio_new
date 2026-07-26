import Image from "next/image";
import Link from "next/link";
import { getArtworks } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";

// Read live from Supabase on every request so admin edits appear immediately.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse the collection",
  description: "A simple grid view of the artwork.",
};

export default async function BrowsePage() {
  const artworks = await getArtworks();

  return (
    <div className="min-h-dvh bg-[#f4f1ea] text-[#1c1a17]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#f4f1ea]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10">
          <span className="font-serif text-2xl tracking-wide">Yu Jun Jie</span>
          <nav className="flex items-center gap-2">
            <Link
              href="/about"
              className="rounded-full border border-black/15 px-4 py-2 text-base transition hover:bg-black/[0.04]"
            >
              About
            </Link>
            <Link
              href="/"
              className="rounded-full bg-[#8b6842] px-4 py-2 text-base text-white transition hover:opacity-90"
            >
              Enter the 3D gallery →
            </Link>
          </nav>
        </div>
      </header>

      {/* Title */}
      <div className="mx-auto max-w-6xl px-6 pt-12 sm:px-10">
        <h1 className="font-serif text-4xl font-light sm:text-5xl">
          The Collection
        </h1>
        <p className="mt-3 text-lg text-[#1c1a17]/60">
          Tap any piece to see more, its story, and details.
        </p>
      </div>

      {/* Grid */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-2 sm:px-10 lg:grid-cols-3">
        {artworks.map((art) => {
          const price = formatPrice(art.price);
          const sold = art.status === "sold";
          return (
            <Link
              key={art.id}
              href={`/artwork/${art.id}`}
              aria-label={`View ${art.title}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6842]"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#e7e2d6]">
                {art.image_url ? (
                  <Image
                    src={art.image_url}
                    alt={art.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: art.gradient_bg ?? "#d9d4c9" }}
                  />
                )}
                {sold && (
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white">
                    Sold
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-serif text-2xl leading-tight">{art.title}</h2>
                <p className="mt-1 text-base text-[#1c1a17]/55">
                  {art.year} · {art.medium}
                </p>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-lg font-medium">
                    {sold ? "Sold" : price ?? "Price on request"}
                  </span>
                  <span className="text-base text-[#8b6842] transition group-hover:translate-x-0.5">
                    View →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </main>

      <footer className="border-t border-black/10 px-6 py-10 text-center text-sm text-[#1c1a17]/50 sm:px-10">
        Prefer an immersive experience?{" "}
        <Link href="/" className="text-[#8b6842] underline underline-offset-2">
          Walk the 3D gallery
        </Link>
      </footer>
    </div>
  );
}
