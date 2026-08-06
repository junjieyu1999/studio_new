// Route an image through Next's optimizer so 3D textures (and the artist photo)
// download a resized, compressed version instead of the multi-MB original.
// Same-origin, so no CORS issues for three.js TextureLoader, and cached at the
// edge after the first request.
export function optimizedTexture(
  src: string,
  width = 1200,
  quality = 68
): string {
  if (!src) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}
