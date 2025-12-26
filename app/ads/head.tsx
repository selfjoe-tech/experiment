// app/ads/head.tsx
import React from "react";

const SITE_NAME = "Upskirt Candy";
const BASE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

export default function Head() {
  const url = `${BASE_URL}/ads`;

  const title = `Advertise on ${SITE_NAME} | In-feed video, image, and banner ads`;
  const description =
    "Promote your brand with in-feed video, image, and banner ads on Upskirt Candy. Sponsored posts appear in the feed with views, likes, and clicks tracked. Contact sales@upskirtcandy.com to get started.";

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
    mainEntity: {
      "@type": "Service",
      "@id": `${url}#ads-service`,
      name: `Advertising on ${SITE_NAME}`,
      description:
        "Sponsored video, image, and banner placements inside the Upskirt Candy feed with view and click tracking.",
      provider: {
        "@type": "Organization",
        name: SITE_NAME,
        url: BASE_URL,
      },
      areaServed: {
        "@type": "Place",
        name: "Worldwide",
      },
      availableChannel: {
        "@type": "ServiceChannel",
        name: "Email",
        serviceUrl: "mailto:sales@upskirtcandy.com",
      },
    },
    potentialAction: {
      "@type": "ContactAction",
      target: "mailto:sales@upskirtcandy.com",
      name: `Contact ${SITE_NAME} ad sales`,
    },
  };

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index,follow" />
      <meta
        name="googlebot"
        content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"
      />

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
