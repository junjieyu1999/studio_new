"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ArtworkImage } from "@/types/artwork";

export interface Slot {
  key: number;
  label: string;
  hint: string;
}

export function ImageSlot({
  slot,
  image,
  artworkId,
  onUploaded,
  onDeleted,
}: {
  slot: Slot;
  image: ArtworkImage | null;
  artworkId: string;
  onUploaded: (img: ArtworkImage) => void;
  onDeleted: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return setError("Image files only");
    if (file.size > 8 * 1024 * 1024) return setError("Max 8 MB");
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("artworkId", artworkId);
      fd.append("sortOrder", String(slot.key));
      const res = await fetch("/api/artworks/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUploaded(json.image as ArtworkImage);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!image) return;
    if (!window.confirm("Remove this image?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/artworks/${artworkId}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: image.id, filename: image.filename }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onDeleted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[#1c1a17]">{slot.label}</span>
        {slot.key === 0 && (
          <span className="rounded-sm border border-[#8b6842]/30 bg-[#8b6842]/10 px-1.5 py-px font-mono text-[0.5rem] uppercase tracking-wider text-[#8b6842]">
            gallery cover
          </span>
        )}
      </div>
      <span className="mb-1 text-xs text-[#1c1a17]/45">{slot.hint}</span>

      {image ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[3/4] overflow-hidden rounded border border-black/10 bg-[#efece5]">
            <Image src={image.url} alt={slot.label} fill sizes="240px" className="object-cover" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded border border-black/15 py-1.5 text-xs transition hover:bg-black/[0.03]"
            >
              Replace
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded border border-red-700/25 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-700/[0.05] disabled:opacity-40"
            >
              {deleting ? "…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 rounded border border-dashed p-4 text-center text-xs transition ${
            dragging
              ? "border-[#8b6842] bg-[#8b6842]/[0.04]"
              : "border-black/20 bg-[#efece5] hover:border-[#8b6842]"
          } ${uploading ? "cursor-default opacity-70" : ""}`}
        >
          {uploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#8b6842]/30 border-t-[#8b6842]" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <span className="text-xl text-[#1c1a17]/40">↑</span>
              <span className="text-[#1c1a17]/60">Drop or click to upload</span>
              <span className="text-[0.6rem] text-[#1c1a17]/40">JPG · PNG · WebP · max 8MB</span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
