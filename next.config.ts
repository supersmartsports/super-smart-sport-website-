import type { NextConfig } from "next";

const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const nextConfig: NextConfig = {
  compress: true,
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 31536000 },
  // Models, posters, brand files and textures never change under the same name, so browsers
  // keep them for a year and revisits are instant.
  async headers() {
    return [
      { source: "/models/:path*", headers: forever },
      { source: "/images/:path*", headers: forever },
      { source: "/brand/:path*", headers: forever },
      { source: "/textures/:path*", headers: forever },
    ];
  },
};

export default nextConfig;
