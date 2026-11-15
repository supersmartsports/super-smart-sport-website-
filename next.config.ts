import type { NextConfig } from "next";

const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 31536000 },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Models, posters, brand files and textures never change under the same name, so browsers
      // keep them for a year and revisits are instant.
      { source: "/models/:path*", headers: forever },
      { source: "/images/:path*", headers: forever },
      { source: "/brand/:path*", headers: forever },
      { source: "/textures/:path*", headers: forever },
      // The private area: never cached, never indexed, never framed.
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
