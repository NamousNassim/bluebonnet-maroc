import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/locale";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panier", "/checkout", "/commande/", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
