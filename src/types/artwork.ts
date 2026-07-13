export type ArtworkStatus = "available" | "sold" | "in-progress";
export type ArtworkTheme = "portrait" | "landscape";

export interface Artwork {
  id: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  status: ArtworkStatus;
  theme: ArtworkTheme;
  description: string | null;
  inspiration: string | null;
  process: string | null;
  gradient_bg: string | null;
  image_url: string | null;
  sort_order: number | null;
  created_at: string;
}

export interface ArtworkImage {
  id: string;
  artwork_id: string;
  url: string;
  filename: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface ArtworkWithImages extends Artwork {
  images: ArtworkImage[];
}
