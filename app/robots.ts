import type { MetadataRoute } from "next";

// Keep scripts/styles crawlable: Google must be able to render page assets.
// Private/account pages use X-Robots-Tag: noindex in proxy.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    }],
    sitemap: "https://goongram.com/sitemap.xml",
  };
}
