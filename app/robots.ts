import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/admin/", "/auth/", "/upload", "/verify",
        "/edit-profile", "/preferences", "/saved", "/liked",
        "/earn", "/download/", "/watermark",
      ],
    }],
    sitemap: "https://goongram.com/sitemap.xml",
  };
}
