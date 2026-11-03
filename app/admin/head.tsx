import React from "react";

export default function Head() {
  const base =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://goongram.com").replace(/\/$/, "");
  const url = `${base}/admin`;

  return (
    <>
      <title>Admin | Goon Gram</title>
      <meta name="robots" content="noindex,nofollow,noarchive" />
      <meta name="googlebot" content="noindex,nofollow,noarchive" />
      <link rel="canonical" href={url} />
    </>
  );
}
