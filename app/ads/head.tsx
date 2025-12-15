// app/ads/head.tsx
import React from "react";

export default function Head() {
  const siteName = "UpskirtCandy";
  const baseUrl = "https://upskirtcandy.com";
  const url = `${baseUrl}/ads`;

  const title = `Advertise on ${siteName} | In-feed video, image & banner ads`;
  const description =
    "Promote your brand with in-feed video, image, and banner ads on UpskirtCandy. Sponsored posts appear in the feed with views, likes, and clicks tracked. Contact sales@upskirtcandy.com to get started.";

  const image = `${baseUrl}/ads-og.jpg`; // <- create this OG image if you want, or change to your default

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${baseUrl}/#website`,
      name: siteName,
      url: baseUrl,
    },
    mainEntity: {
      "@type": "Service",
      "@id": `${url}#ads-service`,
      name: `Advertising on ${siteName}`,
      description:
        "Sponsored video, image, and banner placements inside the UpskirtCandy feed with view and click tracking.",
      provider: {
        "@type": "Organization",
        name: siteName,
        url: baseUrl,
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
      name: "Contact UpskirtCandy ad sales",
    },
  };

  return (
    <>
      {/* Basic SEO */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index,follow" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
