// app/auth/signup/head.tsx
import React from "react";

const SITE_NAME = "Upskirt Candy";
const BASE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

export default function Head() {
  const url = `${BASE_URL}/auth/signup`;

  const title = `Sign up for ${SITE_NAME}`;
  const description =
    "Create your Upskirt Candy account to keep watching, upload your own content, and grow your creator profile.";

  const image = DEFAULT_OG_IMAGE;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      name: SITE_NAME,
      url: BASE_URL,
    },
    potentialAction: {
      "@type": "RegisterAction",
      target: url,
      name: `Sign up for ${SITE_NAME}`,
    },
  };

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index,follow" />
      <meta name="googlebot" content="index,follow" />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
