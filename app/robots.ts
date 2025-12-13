// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://upskirtcandy.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/auth",
          "/ads/upload",
          "/api",
          "/_next",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
