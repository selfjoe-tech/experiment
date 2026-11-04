import type { Metadata } from "next";
import { Suspense } from "react";
import ProfileMediaPage from "./ProfileMediaPage";
import { getProfileSeoByUsername } from "@/lib/actions/seo";
import { notFound } from "next/navigation";


const SITE_NAME = "Goon Gram";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://goongram.com").replace(/\/$/, "");
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

function abs(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// Your profiles are at `/${username}` (based on your links)
function profilePath(username: string) {
  return `/${encodeURIComponent(username)}`;
}

// Optional: reduce DB hits. Adjust as you like.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params
  const raw = username ?? "";
  const name = decodeURIComponent(raw).trim();
  const canonical = abs(profilePath(name));

  const prof = await getProfileSeoByUsername(username);

  // If it doesn't exist, don't let Google index random junk URLs
  if (!prof) {
    return {
      title: "Profile not found",
      description: `This profile does not exist on ${SITE_NAME}.`,
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const title = `${prof.username} | ${SITE_NAME}`;
  const description = `View ${prof.username}'s profile on ${SITE_NAME}. Discover trending adult GIFs, videos, and creators.`;

  const ogImage = prof.avatarUrl || DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical },

    openGraph: {
      type: "profile",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${prof.username} on ${SITE_NAME}`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    },
  };
}

function ProfileFallback() {
  return <div className="mx-auto w-full max-w-4xl px-4 py-8">
    <div className="mb-9 flex items-center gap-8 animate-pulse">
      <div className="h-28 w-28 shrink-0 rounded-full bg-white/10"/>
      <div className="flex-1 space-y-4"><div className="h-5 w-1/3 rounded bg-white/10"/><div className="h-4 w-2/3 rounded bg-white/10"/></div>
    </div>
    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
      {Array.from({length: 12},(_,i)=><div key={i} className="aspect-square animate-pulse bg-white/[.055]"/>)}
    </div>
  </div>;
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {

  const RESERVED = new Set(["sitemap.xml", "robots.txt", "favicon.ico"]);


  const { username } = await params
    const u = username.toLowerCase();
  if (RESERVED.has(u)) notFound();

  // Keep your UI exactly the same: username is read in the client via useParams()
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileMediaPage />
    </Suspense>
  );
}
