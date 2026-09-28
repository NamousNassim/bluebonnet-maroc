import type { NextConfig } from "next";

// Server-side address of the Bluebonnet API. The browser never sees it: it calls /api/* on the
// storefront's own origin (first-party cookie, no CORS) and Next forwards the request.
const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Product photos will come from object storage; list its host here when it exists.
    remotePatterns: process.env.IMAGE_HOST ? [{ protocol: "https", hostname: process.env.IMAGE_HOST }] : [],
  },
  async rewrites() {
    // Only the public storefront API is proxied; /api/internal/* (machine management) never is.
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/v1/:path*` }];
  },
};

export default nextConfig;
