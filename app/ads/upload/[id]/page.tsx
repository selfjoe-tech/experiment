"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  X,
  FileVideo,
  ImagePlus,
  Loader2,
  ArrowUpRightFromSquare,
} from "lucide-react";

import type { Video } from "@/app/components/feed/types";
import { SponsoredVideoCard } from "@/app/components/feed/VideoCard";

import {
  fetchAdBuyerSlotById,
  uploadAdForSlot,
  type AdBuyerSlot,
  type AdMediaType,
} from "@/lib/actions/ads";

import { use as usePromise } from "react"; // 👈 add this



import use from "react"

const ACCENT_START = "#a855f7";
const ACCENT_END = "#ec4899";

type SlotStatus = "loading" | "active" | "expired" | "not-found" | "error";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function AdsUploadPage({ params }: PageProps) {
      const { id: adBuyerId } = usePromise(params); // 👈 unwrap once

  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/";


  // ad slot state
  const [slotStatus, setSlotStatus] = useState<SlotStatus>("loading");
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const [adSlot, setAdSlot] = useState<AdBuyerSlot | null>(null);

  // file & form state
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"video" | "image" | "banner" | null>(
    null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [landingUrl, setLandingUrl] = useState("");
  const [description, setDescription] = useState("");

  const [prepError, setPrepError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepTarget, setPrepTarget] = useState<
    "video" | "image" | "banner" | null
  >(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);


  // check ad slot viability (ad_buyers row) on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const slot = await fetchAdBuyerSlotById(adBuyerId);

        if (cancelled) return;

        if (!slot) {
          setSlotStatus("not-found");
          setSlotMessage(
            "We couldn't find this ad slot. Please contact support."
          );
          return;
        }

        setAdSlot(slot);

        const now = new Date();
        const expiresAt = slot.expires_at ? new Date(slot.expires_at) : null;

        if (!expiresAt || expiresAt <= now || slot.status === "expired") {
          setSlotStatus("expired");
          setSlotMessage(
            "This ad slot has expired. Please renew your slot to upload new ads."
          );
          return;
        }

        setSlotStatus("active");
      } catch (err) {
        console.error("error checking ad slot", err);
        if (!cancelled) {
          setSlotStatus("error");
          setSlotMessage(
            "Something went wrong while checking your ad slot. Please try again."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adBuyerId]);

  // clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {}
      }
    };
  }, [previewUrl]);

  const onClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(redirect);
    }
  };

  async function handlePickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    if (!f) return;
    if (slotStatus !== "active") return;

    setPrepError(null);
    setIsPreparing(true);
    setPrepTarget("video");

    try {
      const url = URL.createObjectURL(f);
      await ensureVideoUsable(url, { timeoutMs: 10000 });

      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {}
      }

      setPreviewUrl(url);
      setFile(f);
      setFileType("video");
    } catch (err) {
      console.error(err);
      setPrepError(
        "We couldn't load this video. Try another file (H.264/AAC MP4 is safest)."
      );
    } finally {
      setIsPreparing(false);
      setPrepTarget(null);
    }
  }

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    if (!f) return;
    if (slotStatus !== "active") return;

    setPrepError(null);

    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    }

    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFile(f);
    setFileType("image");
  }

  function handlePickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    if (!f) return;
    if (slotStatus !== "active") return;

    setPrepError(null);

    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    }

    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFile(f);
    setFileType("banner");
  }

  const canSubmit =
    slotStatus === "active" &&
    !!file &&
    !!fileType &&
    !!landingUrl.trim() &&
    !processing;

  async function handleSubmit() {
    if (!canSubmit || !file || !fileType || !adSlot) {
      setProcessingError("Please select a creative and fill in the URL.");
      return;
    }

    const trimmedUrl = landingUrl.trim();

    if (!trimmedUrl) {
      setProcessingError("Please enter the website URL for your ad.");
      return;
    }

    // basic URL validation
    try {
      const parsed = new URL(trimmedUrl);
      if (!parsed.protocol.startsWith("http")) {
        throw new Error("bad protocol");
      }
    } catch {
      setProcessingError(
        "Please enter a valid URL starting with http:// or https://"
      );
      return;
    }

    try {
      setProcessing(true);
      setProcessingError(null);
      setProgress(10);

      const mediaType: AdMediaType = fileType; // "video" | "image" | "banner"

      await uploadAdForSlot({
        adBuyerId,
        ownerId: adSlot.user_id,
        file,
        mediaType,
        landingUrl: trimmedUrl,
        description: description.trim() || null,
      });

      setProgress(100);

      router.push(redirect);
    } catch (err: any) {
      console.error(err);
      setProcessingError(
        err?.message ?? "Upload failed. Please try again in a moment."
      );
    } finally {
      setProcessing(false);
    }
  }

  // build preview Video object for SponsoredVideoCard
  const sponsoredPreview: Video | null =
    previewUrl && fileType === "video"
      ? {
          id: "ad-preview",
          mediaId: 0,
          src: previewUrl,
          title:
            description.trim().slice(0, 80) || "Sponsored video preview",
          description:
            description.trim() ||
            "Turn every swipe into an opportunity with a full-screen UpskirtCandy ad.",
          username: "yourbrand",
          avatar: "/avatar-placeholder.png",
          likes: 0,
          views: 0,
          hashtags: ["Sponsored"],
          ownerId: adSlot?.user_id ?? undefined,
        }
      : null;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)] bg-black text-white">
      {/* Upload progress overlay */}
      {processing && (
        <div className="fixed bottom-4 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-white/15 bg-black/80 p-4 space-y-2 shadow-xl">
            <div className="flex justify-between text-xs text-white/80">
              <span>Uploading ad…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(90deg, rgb(236,72,153), rgb(251,191,36))",
                }}
              />
            </div>
            {processingError && (
              <p className="text-xs text-red-400 mt-1">{processingError}</p>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-center h-14 bg-black/80 backdrop-blur border-b border-white/10">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute left-4 rounded-full p-2 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Upload ad</h1>
      </header>

      <div className="mx-auto max-w-[880px] px-4 py-6 space-y-6">
        {/* Slot status messages */}
        {slotStatus !== "active" ? (
          <Card className="bg-[#101010] border-white/15 rounded-3xl px-4 sm:px-6 py-6 space-y-3">
            <p className="text-sm font-semibold">
              {slotStatus === "loading"
                ? "Checking your ad slot…"
                : slotStatus === "expired"
                ? "Ad slot expired"
                : slotStatus === "not-found"
                ? "Ad slot not found"
                : "Ad upload unavailable"}
            </p>
            <p className="text-xs text-white/70">
              {slotMessage ?? "You currently cannot upload an ad for this slot."}
            </p>
            <p className="text-xs text-white/60">
              Need help?{" "}
              <a
                href="mailto:sales@upskirtcandy.com"
                className="underline text-pink-400"
              >
                Contact sales
              </a>
              .
            </p>
          </Card>
        ) : (
          <>
            {/* File picker + preview */}
            <Card className="bg-[#101010] border-white/15 rounded-3xl px-4 sm:px-6 py-6 space-y-5">
              <p className="text-center text-white/90 text-base mb-3">
                Choose a placement and upload your creative.
              </p>

              <div className="grid gap-3 md:grid-cols-3">
                <BigOutlineButton
                  onClick={() => videoInputRef.current?.click()}
                  icon={<FileVideo className="h-5 w-5" />}
                  label="In-feed sponsored video"
                  helper="Vertical or square video. Appears after 2–3 organic clips."
                />
                <BigOutlineButton
                  onClick={() => imageInputRef.current?.click()}
                  icon={<ImagePlus className="h-5 w-5" />}
                  label="Desktop side-column card"
                  helper="Wide image. Shown on the right side of the desktop feed."
                />
                <BigOutlineButton
                  onClick={() => bannerInputRef.current?.click()}
                  icon={<ImagePlus className="h-5 w-5" />}
                  label="Top-of-feed mobile banner"
                  helper="Pill-style banner at the very top of the mobile feed."
                />
              </div>

              {/* Hidden inputs */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handlePickVideo}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickImage}
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickBanner}
              />

              {prepError && (
                <p className="text-xs text-red-400 px-1 mt-2">{prepError}</p>
              )}

              {/* PREVIEW AREA: matches /ads page look & feel */}

              {fileType === "video" && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                        Sponsored Video Preview
                      </span>
                      <span className="text-[11px] text-white/50">
                        Appears after 2–3 organic clips in Trending / For You.
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60">
                      Recommended: short MP4/WebM, under ~60s.
                    </p>
                  </div>

                  <div className="bg-black px-2 pb-3 pt-2 rounded-2xl border border-white/10">
                    {sponsoredPreview ? (
                      <SponsoredVideoCard
                        video={sponsoredPreview}
                        isMuted={true}
                        toggleMute={() => {}}
                        onRequestFullscreen={() => {}}
                        visitUrl={
                          landingUrl.trim() || "https://your-landing-page.example.com"
                        }
                      />
                    ) : (
                      <div className="py-4">
                        <VideoCardSkeleton />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {fileType === "image" && (
                <div className="mt-6 space-y-3">
                  <SideColumnPreview imageUrl={previewUrl} />
                </div>
              )}

              {fileType === "banner" && (
                <div className="mt-6 space-y-3">
                  <TopBannerPreview imageUrl={previewUrl} />
                </div>
              )}

              {!fileType && (
                <p className="text-xs text-white/60 mt-4">
                  Start by selecting a placement above to see a live preview.You can make changes to your ads in the {'"manage"'} page where normal content is
                </p>
              )}
            </Card>

            {/* Details + upload */}
            <Card className="bg-[#101010] border-white/15 rounded-3xl px-4 sm:px-6 py-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs text-white/70">
                  Landing page URL/website
                </label>
                <Input
                  type="url"
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                  placeholder="https://your-site.com/offer"
                  className="w-full h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm text-white"
                />
                <p className="text-[11px] text-white/50">
                  This is where users will be sent when they tap{" "}
                  <span className="font-semibold">Visit page</span> on your ad.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-white/70">
                  Description / caption (optional)
                </label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write a short caption for your ad…"
                  className="w-full rounded-md bg-black/40 border border-white/20 px-3 py-2 text-sm text-white"
                />
                {fileType === "video" && (
                  <p className="text-[11px] text-white/50">
                    This caption appears under your sponsored video preview.
                  </p>
                )}
              </div>

              {processingError && !processing && (
                <p className="text-xs text-red-400">{processingError}</p>
              )}

              <div className="flex justify-between items-center pt-2 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="rounded-full text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`h-11 px-6 rounded-full text-xs font-semibold ${
                    canSubmit
                      ? "text-black"
                      : "opacity-60 cursor-not-allowed text-black"
                  }`}
                  style={{ backgroundColor: "pink" }}
                >
                  {processing ? "Uploading…" : "Upload ad"}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* preparing overlay for video metadata */}
      {isPreparing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur grid place-items-center">
          <div className="rounded-2xl border border-white/15 bg-black/80 px-6 py-5 flex items-center gap-3 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>
              {prepTarget === "video"
                ? "Preparing your video…"
                : "Preparing your file…"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BigOutlineButton({
  onClick,
  icon,
  label,
  helper,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  helper: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left h-full rounded-2xl border border-white/35 bg-black/30 hover:bg-white/10 px-4 py-3 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/10 border border-white/25">
          {icon}
        </span>
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <p className="text-[11px] text-white/60">{helper}</p>
    </button>
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

/** Desktop side-column card style preview */
function SideColumnPreview({ imageUrl }: { imageUrl: string | null }) {
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
            <span className="font-semibold text-sm">Your Brand Name</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">
              Sponsored
            </span>
          </div>
          <div className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full bg-white text-black py-1.5">
            Visit Page
            <ArrowUpRightFromSquare size={16} />
          </div>
        </div>
      </div>
      <p className="text-[11px] text-white/60">
        Recommended image size for this placement:{" "}
        <span className="font-semibold">1200 × 600 px</span> (2:1 ratio).
      </p>
    </div>
  );
}

/** Top-of-feed mobile banner style preview */
function TopBannerPreview({ imageUrl }: { imageUrl: string | null }) {
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
      <p className="text-[11px] text-white/60">
        Recommended: <span className="font-semibold">1200 × 320 px</span>{" "}
        (approx 4:1) for a clean top-of-feed banner.
      </p>
    </div>
  );
}

/** Preflight: ensure the blob VIDEO URL is usable */
async function ensureVideoUsable(
  url: string,
  { timeoutMs = 10000 }: { timeoutMs?: number } = {}
) {
  const v = document.createElement("video");
  v.preload = "metadata";
  (v as any).muted = true;
  (v as any).playsInline = true;
  v.src = url;

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("metadata-timeout")),
      timeoutMs
    );
    v.addEventListener(
      "loadedmetadata",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
    v.addEventListener(
      "error",
      () => {
        clearTimeout(t);
        reject(new Error("metadata-error"));
      },
      { once: true }
    );
  });

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    v.addEventListener("canplay", done, { once: true });
    setTimeout(done, 150);
  });
}
