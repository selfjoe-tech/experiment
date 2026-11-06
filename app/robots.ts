import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent:"*",
      allow:"/",
      // Keep noindex pages crawlable so search engines can read their directives.
      disallow:["/api/","/_next/","/admin/"],
    }],
    sitemap:"https://goongram.com/sitemap.xml",
    host:"https://goongram.com",
  };
}
