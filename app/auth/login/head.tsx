// app/auth/login/head.tsx
import React from "react";

export default function Head() {
  const siteName = "UpskirtCandy";
  const baseUrl = "https://upskirtcandy.com";
  const url = `${baseUrl}/auth/login`;

  const title = `Log in to ${siteName}`;
  const description =
    "Log in to UpskirtCandy to upload content, manage your creator profile, track views, likes, and ad performance.";

  const image = `${baseUrl}/og-default.jpg`; // use your global OG image

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
    potentialAction: {
      "@type": "LoginAction",
      target: url,
      name: `Log in to ${siteName}`,
    },
  };

  return (
    <>
      {/* Basic SEO */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {/* Auth pages generally should not be indexed */}
      <meta name="robots" content="noindex,nofollow" />

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
