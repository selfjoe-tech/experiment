import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Download, Film, Play } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import InlineContentAd from "@/app/components/ads/InlineContentAd";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";
import DownloadVideoButton from "./DownloadVideoButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type DownloadVideo = {
  id: number;
  title: string;
  description: string;
  username: string;
  avatarUrl: string | null;
  sourceUrl: string;
  directDownloadUrl: string | null;
  filename: string;
  durationSeconds: number | null;
};

function validId(raw: string): number | null {
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function safeFilename(title: string, id: number, storagePath: string) {
  const slug = title.normalize("NFKD").replace(/[^a-zA-Z0-9 -]/g, "")
    .trim().replace(/\s+/g, "-").slice(0, 70).toLowerCase() || "video";
  const ext = /\.(mp4|webm|mov|m4v)(?:\?|$)/i.exec(storagePath)?.[1]?.toLowerCase() || "mp4";
  return `goongram-${id}-${slug}.${ext}`;
}

async function getVideo(id: number): Promise<DownloadVideo | null> {
  const client = await createClient();
  const { data, error } = await client.from("media")
    .select("id,media_type,title,description,storage_path,duration_seconds,owner:profiles!media_owner_id_fkey(username,avatar_url)")
    .eq("id", id).eq("media_type", "video").maybeSingle();
  if (error || !data?.storage_path) return null;

  const owner = data.owner as unknown as { username?: string | null; avatar_url?: string | null } | null;
  const username = owner?.username || "creator";
  const title = (data.title || "").trim() ||
    (data.description || "").trim().slice(0, 110) ||
    `Video by @${username}`;
  const filename = safeFilename(title, id, data.storage_path);
  const directUrl = /^https:\/\//i.test(data.storage_path)
    ? null
    : client.storage.from("media").getPublicUrl(data.storage_path, { download: filename }).data.publicUrl;

  const sourceUrl = directUrl
    ? client.storage.from("media").getPublicUrl(data.storage_path).data.publicUrl
    : data.storage_path;

  // Media rows may hold a full R2 URL. Only expose HTTPS media sources.
  if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) return null;

  return {
    id,
    title,
    description: data.description || "",
    username,
    avatarUrl: owner?.avatar_url || null,
    sourceUrl,
    directDownloadUrl: directUrl,
    filename,
    durationSeconds: data.duration_seconds == null ? null : Number(data.duration_seconds),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = validId((await params).id);
  if (!id) return { title: "Video unavailable", robots: { index: false, follow: false } };
  const video = await getVideo(id);
  return {
    title: video ? `Download ${video.title}` : "Video unavailable",
    description: video ? `Download ${video.title} from Goongram.` : "This video could not be found.",
    robots: { index: false, follow: false },
    alternates: { canonical: `https://goongram.com/download/${id}` },
  };
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export default async function DownloadVideoPage({ params }: PageProps) {
  const id = validId((await params).id);
  if (!id) notFound();
  const video = await getVideo(id);
  if (!video) notFound();

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <DesktopShell />
      <MobileChrome />
      <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pb-28 pt-[82px] sm:px-7 lg:pl-[104px] lg:pr-7 lg:pt-10">
        <div className="mx-auto max-w-[1110px]">
          <div className="mb-7 flex items-center justify-between gap-3 border-b border-white/10 pb-5">
            <a href={`/watch/${video.id}`} className="inline-flex items-center gap-2 text-[13px] text-white/65 transition hover:text-white">
              <ArrowLeft size={17} />
              Back to video
            </a>
            <span className="text-[12px] text-white/45">Download video</span>
          </div>

          <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_328px] lg:gap-8">
            <article className="min-w-0">
              <header>
                <div className="flex items-center gap-3">
                  <a href={`/${encodeURIComponent(video.username)}`} aria-label={`View ${video.username}'s profile`}
                    className="shrink-0 overflow-hidden rounded-full">
                    <Image unoptimized src={video.avatarUrl || "/avatar-placeholder.png"}
                      alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full object-cover"/>
                  </a>
                  <div className="min-w-0">
                    <a href={`/${encodeURIComponent(video.username)}`}
                      className="block truncate text-[13px] font-semibold hover:underline">
                      {video.username}
                    </a>
                    <p className="text-[11px] text-white/45">Video download</p>
                  </div>
                </div>
                <h1 className="mt-6 break-words text-[24px] font-semibold leading-[1.24] tracking-[-0.04em] sm:text-[30px]">
                  {video.title}
                </h1>
              </header>

              <div className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-black">
                <video src={video.sourceUrl} controls playsInline preload="metadata"
                  className="mx-auto block aspect-video max-h-[490px] w-full bg-black object-contain"
                  aria-label={video.title}/>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 text-xs text-white/45">
                <span className="inline-flex items-center gap-1.5"><Film size={14}/> Video</span>
                {formatDuration(video.durationSeconds) &&
                  <span className="inline-flex items-center gap-1.5"><Play size={13}/> {formatDuration(video.durationSeconds)}</span>}
                <a href={`/watch/${video.id}`} className="ml-auto inline-flex items-center gap-1 font-medium text-white/65 hover:text-white">
                  Full video <ArrowUpRight size={14}/>
                </a>
              </div>

              <section className="mt-7 border-t border-white/10 pt-7">
                <h2 className="text-[17px] font-semibold tracking-tight">Download this video</h2>
                <p className="mt-2 max-w-[530px] text-[13px] leading-6 text-white/50">
                  Save the original uploaded video to your device. Your download begins when you select the button below.
                </p>
                <div className="mt-5">
                  <DownloadVideoButton
                    sourceUrl={video.sourceUrl}
                    directDownloadUrl={video.directDownloadUrl}
                    filename={video.filename}/>
                </div>
              </section>

              <section className="mt-9 border-t border-white/10 pt-6" aria-label="Sponsored advertisement">
                <p className="mb-4 text-[11px] font-medium text-white/45">Sponsored</p>
                <InlineContentAd variant="banner"/>
              </section>
            </article>

            <aside className="min-w-0 border-t border-white/10 pt-6 lg:border-t-0 lg:pt-0" aria-label="Sponsored placements">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium text-white/65">Sponsored</span>
                <span className="text-[11px] text-white/35">More offers</span>
              </div>
              <StaticPageAdPair />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
