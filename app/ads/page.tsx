"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Video } from "@/app/components/feed/types";
import { SponsoredVideoCard } from "@/app/components/feed/VideoCard";
import { ChartSpline, Mail, ArrowUpRightFromSquare, UploadCloud } from "lucide-react";
import { LongLogo } from "../components/icons/LongLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const ACCENT_START = "#a855f7";
const ACCENT_END = "#ec4899";

const demoAdVideo: Video = {
  id: "ad-demo-1",
  mediaId: 0,
  src: "/demo-ad.mp4",
  title: "Your Brand. Full Screen.",
  description:
    "Turn every swipe into an opportunity. Show your product in immersive, sound-on video directly in the UpskirtCandy feed.",
  username: "yourbrand",
  avatar: "/avatar-placeholder.png",
  likes: 1240,
  views: 48000,
  hashtags: ["Sponsored", "Ad"],
  ownerId: "00000000-0000-0000-0000-000000000000",
};

type SponsoredPreviewState = {
  objectUrl: string;
  description: string;
  visitUrl: string;
};

type ImagePreviewState = {
  objectUrl: string;
};

export default function AdsPage() {
  // Sponsored video preview state
  const [sponsoredPreview, setSponsoredPreview] =
    useState<SponsoredPreviewState | null>(null);
  const [sponsoredDialogOpen, setSponsoredDialogOpen] = useState(false);
  const [sponsoredFile, setSponsoredFile] = useState<File | null>(null);
  const [sponsoredDescription, setSponsoredDescription] = useState("");
  const [sponsoredUrl, setSponsoredUrl] = useState("");

  // Top-of-feed mobile banner preview
  const [topBannerPreview, setTopBannerPreview] =
    useState<ImagePreviewState | null>(null);
  const [topBannerDialogOpen, setTopBannerDialogOpen] = useState(false);
  const [topBannerFile, setTopBannerFile] = useState<File | null>(null);

  // Side-column card preview
  const [sideBannerPreview, setSideBannerPreview] =
    useState<ImagePreviewState | null>(null);
  const [sideBannerDialogOpen, setSideBannerDialogOpen] = useState(false);
  const [sideBannerFile, setSideBannerFile] = useState<File | null>(null);

  // Handlers for sponsored video "try it out"
  const handleSponsoredSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsoredFile) return;

    const objectUrl = URL.createObjectURL(sponsoredFile);
    setSponsoredPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return {
        objectUrl,
        description: sponsoredDescription.trim(),
        visitUrl: sponsoredUrl.trim(),
      };
    });
    setSponsoredDialogOpen(false);
  };

  // Handlers for top banner image
  const handleTopBannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topBannerFile) return;

    const objectUrl = URL.createObjectURL(topBannerFile);
    setTopBannerPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return { objectUrl };
    });
    setTopBannerDialogOpen(false);
  };

  // Handlers for side banner image
  const handleSideBannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sideBannerFile) return;

    const objectUrl = URL.createObjectURL(sideBannerFile);
    setSideBannerPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return { objectUrl };
    });
    setSideBannerDialogOpen(false);
  };

  // Build the video object for SponsoredVideoCard if we have a preview
  const sponsoredVideo: Video | null = sponsoredPreview
    ? {
        ...demoAdVideo,
        id: "ad-preview",
        mediaId: 0,
        src: sponsoredPreview.objectUrl,
        title:
          sponsoredPreview.description.slice(0, 80) ||
          "Sponsored preview",
        description:
          sponsoredPreview.description || demoAdVideo.description,
        likes: 0,
        views: 0,
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-16 space-y-16">
        {/* HERO */}
        <section className="grid gap-10 md:grid-cols-[3fr,2fr] items-center">
          <div className="space-y-6">
            <LongLogo />
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-pink-200">
              UpskirtCandy Ads
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-pulse" />
            </div>

            <div className="flex w-full justify-center p-10 md:p-16 lg:p-24">
              <h1 className="text-nowrap text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight">
                Full-screen attention.
                <br />
                <span className="text-pink-400">
                  Zero scroll blindness.
                </span>
              </h1>
            </div>

            <p className="text-sm sm:text-base text-white/70 max-w-xl">
              Ads on UpskirtCandy are designed to feel like premium content,
              not clutter. Your campaign appears between organic videos where
              users are already locked in.
            </p>

            {/* In-feed sponsored video feature */}
            <div className="grid gap-4 text-sm text-white/80">
              <FeatureRow
                title="In-feed sponsored videos"
                body="Sponsored clips appear after every 2–3 organic videos in both Trending and For You feeds, with full like and follow functionality."
              />

              <div className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Sponsored Video Preview
                    </span>
                    <span className="text-[11px] text-white/50">
                      Appears after 2–3 organic clips
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSponsoredDialogOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-white text-black px-3 py-1.5 text-[11px] font-semibold hover:bg-pink-500 hover:text-white"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    Try this placement
                  </button>
                </div>
                <div className="bg-black px-2 pb-3">
                  {sponsoredVideo ? (
                    <SponsoredVideoCard
                      video={sponsoredVideo}
                      isMuted={true}
                      toggleMute={() => {}}
                      onRequestFullscreen={() => {}}
                      visitUrl={sponsoredPreview!.visitUrl}
                      
                      
                    />
                  ) : (
                    <div className="py-4">
                      <VideoCardSkeleton />
                    </div>
                  )}
                </div>
              </div>

              {/* Side column feature + preview */}
              <FeatureRow
                title="Side column of feed"
                body="A bold visual card appears at the side of the feed on desktop, giving your brand premium placement beside the main video feed."
              />

              <SideColumnPreview
                imageUrl={sideBannerPreview?.objectUrl ?? null}
                onTry={() => setSideBannerDialogOpen(true)}
              />

              {/* Top-of-feed banner feature + preview */}
              <FeatureRow
                title="Top-of-feed banner card"
                body="A pill-shaped banner appears at the very top of the feed on mobile, giving your brand the first impression before the first swipe."
              />

              <TopBannerPreview
                imageUrl={topBannerPreview?.objectUrl ?? null}
                onTry={() => setTopBannerDialogOpen(true)}
              />
            </div>
          </div>

          {/* RIGHT COLUMN – Call to action */}
          <div className="text-nowrap flex flex-col items-center justify-center gap-3 w-full p-10 md:p-16 h-full rounded-[20px]">
            <h1 className="text-3xl font-semibold leading-tight lg:text-5xl text-center">
              <span className="flex items-center justify-center gap-3">
                Scale Your Traffic In Minutes{" "}
                <ChartSpline className="h-12 w-12 md:h-16 md:w-16" />
              </span>
              <span className="text-pink-400 block mt-2">
                What Are You Waiting For?
              </span>
            </h1>
            <a
              href="mailto:sales@upskirtcandy.com"
              className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-pink-500 hover:text-white"
            >
              <Mail className="h-4 w-4" />
              Contact us
            </a>
          </div>
        </section>
      </main>

      {/* ===== DIALOGS ===== */}

      {/* Sponsored video dialog */}
      <Dialog open={sponsoredDialogOpen} onOpenChange={setSponsoredDialogOpen}>
        <DialogContent className="bg-black text-white border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Try the in-feed sponsored video placement
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Upload a short video, add a description, and a URL. This
              does not save anything to your account – it&apos;s just a
              live preview.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSponsoredSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Video file</Label>
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSponsoredFile(file);
                }}
                className="bg-black border-white/30 text-xs"
              />
              <p className="text-[11px] text-white/50">
                Recommended: MP4 / WebM, up to ~60 seconds, vertical or
                square works best.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                value={sponsoredDescription}
                onChange={(e) => setSponsoredDescription(e.target.value)}
                className="bg-black border-white/30 text-xs"
                placeholder="Write a short caption for your ad…"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Landing URL</Label>
              <Input
                type="url"
                value={sponsoredUrl}
                onChange={(e) => setSponsoredUrl(e.target.value)}
                className="bg-black border-white/30 text-xs"
                placeholder="https://your-landing-page.example.com"
              />
              <p className="text-[11px] text-white/50">
                This is where users go when they tap “Visit Page”.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full text-xs"
                onClick={() => setSponsoredDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-full text-xs font-semibold"
                disabled={!sponsoredFile}
              >
                Apply to preview
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Top-of-feed banner image dialog */}
      <Dialog open={topBannerDialogOpen} onOpenChange={setTopBannerDialogOpen}>
        <DialogContent className="bg-black text-white border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Try the top-of-feed banner
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Upload a banner image to see how it would look at the top of
              the feed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTopBannerSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Banner image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setTopBannerFile(file);
                }}
                className="bg-black border-white/30 text-xs"
              />
              <p className="text-[11px] text-white/50">
                Recommended: <span className="font-semibold">1200 × 320 px</span>{" "}
                (approx 4:1 ratio) for a crisp, pill-style banner on mobile.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full text-xs"
                onClick={() => setTopBannerDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-full text-xs font-semibold"
                disabled={!topBannerFile}
              >
                Apply to preview
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Side-column card image dialog */}
      <Dialog open={sideBannerDialogOpen} onOpenChange={setSideBannerDialogOpen}>
        <DialogContent className="bg-black text-white border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Try the desktop side-column card
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Upload a visual for the right-hand column card on desktop.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSideBannerSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Card image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSideBannerFile(file);
                }}
                className="bg-black border-white/30 text-xs"
              />
              <p className="text-[11px] text-white/50">
                Recommended: <span className="font-semibold">1200 × 600 px</span>{" "}
                (2:1 ratio). This scales nicely into the card’s 320 × 160 visible area.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full text-xs"
                onClick={() => setSideBannerDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-full text-xs font-semibold"
                disabled={!sideBannerFile}
              >
                Apply to preview
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 mt-10">
      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-pink-400" />
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <p className="text-xs text-white/70">{body}</p>
      </div>
    </div>
  );
}

/** Skeleton that mimics a VideoCard layout */
function VideoCardSkeleton() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-neutral-900">
      <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
      <div className="absolute inset-x-0 bottom-0 p-4 space-y-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded-full bg-white/30" />
            <div className="h-3 w-16 rounded-full bg-white/20" />
          </div>
          <div className="h-7 w-20 rounded-full bg-white/25" />
        </div>
        <div className="h-3 w-3/4 rounded-full bg-white/25" />
        <div className="h-3 w-1/2 rounded-full bg-white/15" />
      </div>
    </div>
  );
}

/** Desktop side-column card preview */
function SideColumnPreview({
  imageUrl,
  onTry,
}: {
  imageUrl: string | null;
  onTry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 max-w-sm">
        <div className="relative h-40 bg-gradient-to-br from-purple-500 to-pink-500">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Side-column ad preview"
              fill
              className="object-cover"
              sizes="320px"
            />
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-white">
              Your Brand Name
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">
              Sponsored
            </span>
          </div>
          <button
            type="button"
            onClick={onTry}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full bg-white text-black py-1.5 hover:bg-pink-500 hover:text-white"
          >
            Try this placement
            <ArrowUpRightFromSquare size={16} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-white/60">
        Recommended image size for this placement:{" "}
        <span className="font-semibold">1200 × 600 px</span> (2:1 ratio).
      </p>
    </div>
  );
}

/** Top-of-feed mobile banner preview */
function TopBannerPreview({
  imageUrl,
  onTry,
}: {
  imageUrl: string | null;
  onTry: () => void;
}) {
  const href = "/ads";

  const bgStyle = imageUrl
    ? {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage: `radial-gradient(circle at 0% 0%, ${ACCENT_START}, transparent 55%), radial-gradient(circle at 100% 100%, ${ACCENT_END}, transparent 55%), linear-gradient(135deg, #020617, #0f172a)`,
      };

  return (
    <div className="space-y-3">
      <Link href={href} className="flex flex-col gap-2 max-w-md">
        <div
          className="h-12 px-5 gap-2 w-full flex rounded-[50px] items-center justify-between text-sm font-semibold text-white border border-white/15"
          style={bgStyle}
        >
          <span className="truncate">
            {imageUrl
              ? "Your banner on mobile"
              : "Your ad on mobile will look like this"}
          </span>
          <ArrowUpRightFromSquare size={18} />
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTry}
          className="inline-flex items-center gap-1 rounded-full bg-white text-black px-3 py-1.5 text-[11px] font-semibold hover:bg-pink-500 hover:text-white"
        >
          <UploadCloud className="h-3.5 w-3.5" />
          Try this placement
        </button>
        <p className="text-[11px] text-white/60">
          Recommended: <span className="font-semibold">1200 × 320 px</span>{" "}
          (approx 4:1) for a clean top-of-feed banner.
        </p>
      </div>
    </div>
  );
}
