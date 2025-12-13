// app/auth/signin/head.tsx
import React from "react";

export default function Head() {
  const siteName = "UpskirtCandy";
  const baseUrl = "https://upskirtcandy.com";
  const url = `${baseUrl}/auth/signin`;

  const title = `Sign in to ${siteName}`;
  const description =
    "Sign in to UpskirtCandy with your email code to continue watching, uploading, and managing your creator content.";

  const image = `${baseUrl}/og-default.jpg`;

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
      name: `Sign in to ${siteName}`,
    },
  };

  return (
    <>
      {/* Basic SEO */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
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
