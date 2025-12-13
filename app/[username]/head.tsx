// app/profile/[username]/head.tsx
import React from "react";
import {
  getUserProfileByUsername,
  getFollowCountsByUsername,
} from "@/lib/actions/social";

type Props = {
  // Treat params as a Promise so we can safely await it
  params: Promise<{ username: string }>;
};

function formatCount(n?: number | null): string {
  const num = n ?? 0;
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}M`;
  if (num >= 1_000) return `${Math.floor(num / 1_000)}k`;
  return num.toString();
}

export default async function Head(props: Props) {
  // ✅ Await params, then unwrap username safely
  const resolvedParams = await props.params;
  const rawUsername = resolvedParams?.username ?? "";
  const username = decodeURIComponent(rawUsername);

  const siteName = "UpskirtCandy";
  const baseUrl = "https://upskirtcandy.com";

  // If your public profile URL is actually `/profile/[username]`,
  // change this to `${baseUrl}/profile/${encodeURIComponent(username)}`.
  const url = `${baseUrl}/${encodeURIComponent(username)}`;

  // Fetch profile + follow counts on the SERVER
  const [profile, followCounts] = await Promise.all([
    getUserProfileByUsername(username),
    getFollowCountsByUsername(username),
  ]);

  const displayName = profile.username || username || "Creator";
  const followers = followCounts?.followers ?? 0;
  const following = followCounts?.following ?? 0;
  const views = followCounts?.views ?? 0;

  const title = `${displayName} | ${siteName}`;
  const description = `${displayName}'s GIFs and images on ${siteName}. ${formatCount(
    followers
  )} followers · ${formatCount(views)} views.`;

  const image =
    profile.avatarUrl ||
    `${baseUrl}/og-default.jpg`; // fallback OG image if you have one

  // JSON-LD: treat profile as a creator collection page
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["CollectionPage", "ProfilePage"],
    "@id": `${url}#profile`,
    url,
    name: title,
    description,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${baseUrl}/#website`,
      name: siteName,
      url: baseUrl,
    },
    about: {
      "@type": "Person",
      "@id": `${url}#person`,
      name: displayName,
      url,
      image,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/FollowAction",
          userInteractionCount: followers,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/FollowAction",
          name: "Following",
          userInteractionCount: following,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/ViewAction",
          userInteractionCount: views,
        },
      ],
    },
  };

  return (
    <>
      {/* Basic SEO */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="profile" />
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

      {/* JSON-LD schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
