import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    qualities: [60, 68, 75],
    // Cache optimized images for ~31 days so repeat loads are instant.
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
