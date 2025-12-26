import React from "react";
import {
  getUserProfileByUsername,
  getFollowCountsByUsername,
} from "@/lib/actions/social";

const SITE_NAME = "Upskirt Candy";
const BASE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

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
  // Await params, then unwrap username safely
  const resolvedParams = await props.params;
  const rawUsername = resolvedParams?.username ?? "";
  const username = decodeURIComponent(rawUsername);

  // If your public profile URL is actually `/profile/[username]`,
  // change this to `${BASE_URL}/profile/${encodeURIComponent(username)}`.
  const url = `${BASE_URL}/${encodeURIComponent(username)}`;

  // Fetch profile + follow counts on the SERVER
  const [profile, followCounts] = await Promise.all([
    getUserProfileByUsername(username),
    getFollowCountsByUsername(username),
  ]);

  const displayName = profile.username || username || "Creator";
  const followers = followCounts?.followers ?? 0;
  const following = followCounts?.following ?? 0;
  const views = followCounts?.views ?? 0;

  const title = `${displayName} | ${SITE_NAME}`;
  const description = `${displayName}'s GIFs and images on ${SITE_NAME}. ${formatCount(
    followers
  )} followers and ${formatCount(views)} views.`;

  const image = profile.avatarUrl || DEFAULT_OG_IMAGE; // fallback OG image if you have one

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
      "@id": `${BASE_URL}/#website`,
      name: SITE_NAME,
      url: BASE_URL,
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
      <meta name="robots" content="index,follow" />
      <meta name="googlebot" content="index,follow" />

      {/* Open Graph */}
      <meta property="og:type" content="profile" />
      <meta property="og:site_name" content={SITE_NAME} />
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
