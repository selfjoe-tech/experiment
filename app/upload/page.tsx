"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X, FileVideo, ImagePlus, Loader2 } from "lucide-react";

import VideoTrimEditor from "@/app/components/upload/VideoTrimEditor";
import UploadFlow, {
  type ClipSelection,
  type ImageSelection,
} from "@/app/components/upload/UploadFlow";
import ImagePreviewer, {
  type ImagePreviewPayload,
} from "@/app/components/upload/ImagePreviewer";
import BulkImageSummary from "@/app/components/upload/BulkImageSummary";

import {
  uploadTrimmedVideo,
  uploadSingleImage,
  uploadImagesBatch,
} from "@/lib/actions/media";
import Link from "next/link";
import { getUserProfileFromCookies } from "@/lib/actions/auth";
import { watermarkVideoFile } from "@/lib/client/watermarkVideo";

const ACCENT = "pink";

type PostFlow =
  | { kind: "video"; clip: ClipSelection }
  | { kind: "images"; images: ImageSelection }
  | null;


// Helper: send original clip + range to server, get a *trimmed* File back
async function trimOnServer(
  clip: ClipSelection,
  onProgress?: (pct: number) => void
): Promise<File> {
  const fd = new FormData();
  fd.append("file", clip.file);
  fd.append("start", String(clip.start));
  fd.append("end", String(clip.end));

  // start at 5%
  onProgress?.(5);

  const req = fetch("/api/trim-video", {
    method: "POST",
    body: fd,
  });

  // fake incremental progress while trimming
  let current = 5;
  let intervalId: number | undefined;
  if (onProgress) {
    intervalId = window.setInterval(() => {
      current = Math.min(30, current + 5);
      onProgress(current);
    }, 300);
  }

  const res = await req;

  if (intervalId !== undefined) {
    window.clearInterval(intervalId);
    onProgress?.(30); // done trimming
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Trim failed (${res.status}). ${text || ""}`);
  }

  const blob = await res.blob();
  const trimmedFileName =
    clip.file.name.replace(/\.[^.]+$/, "") + "-trimmed.mp4";

  return new File([blob], trimmedFileName, {
    type: blob.type || "video/mp4",
  });
}



export default function UploadPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/home";

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [wmUsername, setWmUsername] = useState<string>("");

  useEffect(() => {
  (async () => {
    try {
      const prof = await getUserProfileFromCookies();
      if (prof.username) setWmUsername(prof.username);
    } catch (e) {
      console.error("failed to get username for watermark", e);
    }
  })();
}, []);




  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  // video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // images (multi)
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // flow
  const [postFlow, setPostFlow] = useState<PostFlow>(null);

  // UX
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepTarget, setPrepTarget] = useState<"video" | "images" | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const onClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1)
      router.back();
    else router.replace(redirect);
  };

  async function handlePickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    if (!f) return;

    setPrepError(null);
    setIsPreparing(true);
    setPrepTarget("video");

    try {
      const url = URL.createObjectURL(f);
      await ensureVideoUsable(url, { timeoutMs: 10000 });
      setVideoFile(f);
      setVideoUrl(url);
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

  function handlePickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (picked.length === 0) return;
    setPrepError(null);
    setImageFiles(picked); // URLs handled inside ImagePreviewer
  }

  // ===== branches =====

  // 1) video trim editor
  if (videoFile && videoUrl && postFlow === null) {
    return (
      <VideoTrimEditor
        file={videoFile}
        src={videoUrl}
        onBack={() => {
          if (videoUrl) URL.revokeObjectURL(videoUrl);
          setVideoUrl(null);
          setVideoFile(null);
        }}
        onNext={(clip) => setPostFlow({ kind: "video", clip })}
      />
    );
  }

  // 2) image previewer
  if (imageFiles.length > 0 && postFlow === null) {
    return (
      <ImagePreviewer
        files={imageFiles}
        onBack={() => setImageFiles([])}
        onNext={(payload: ImagePreviewPayload) => {
          const images: ImageSelection = {
            files: payload.files,
            order: payload.order,
            coverIndex: payload.coverIndex,
          };
          setPostFlow({ kind: "images", images });
        }}
      />
    );
  }

  // 3) unified UploadFlow – VIDEO
  if (postFlow?.kind === "video") {
  return (
    <UploadFlow
      variant="video"
      clip={postFlow.clip}
      onCancel={() => setPostFlow(null)}
      onSubmit={async (formValues) => {
        // this is called by UploadFlow, which will show/hide its spinner
        setProcessing(true);
        setProcessingError(null);
        setProgress(0);

        try {
          const originalClip = postFlow.clip;
          const clipDuration = originalClip.end - originalClip.start;

          // ---------- 1) TRIM (if needed) ----------
          const needsTrim =
            clipDuration > 60 || originalClip.start > 0; // skip if <60s & start==0

          let workingClip: ClipSelection = originalClip;
          let workingFile: File = originalClip.file;

          if (needsTrim) {
            const trimmedFile = await trimOnServer(originalClip, (pct) =>
              setProgress(pct)
            );
            workingFile = trimmedFile;
            workingClip = {
              ...originalClip,
              file: trimmedFile,
              start: 0,
              end: clipDuration,
            };
          } else {
            // no trim → jump to ~30%
            setProgress(30);
          }

          // ---------- 2) WATERMARK ----------
          setProcessingError(null); // just in case
          const wmName = wmUsername || "user";

          const watermarkedFile = await watermarkVideoFile(workingFile, wmName, {
            position: "bottom-right",
            logoUrl: "/watermark-1.png",
            onProgress: (ratio) => {
              // map 0..1 → 30..90
              const pct = 30 + Math.round(ratio * 60);
              setProgress(Math.min(90, pct));
            },
          });

          const finalClip: ClipSelection = {
            ...workingClip,
            file: watermarkedFile,
            start: 0,
            end: workingClip.end - workingClip.start,
          };

          // ---------- 3) UPLOAD ----------
          setProgress(92);

          const row = await uploadTrimmedVideo(finalClip, {
            title: formValues.description?.slice(0, 80) ?? "",
            description: formValues.description ?? "",
            audience: formValues.audience,
          });

          console.log("Inserted media row:", row);
          setProgress(100);

          setPostFlow(null);
          setVideoFile(null);
          if (videoUrl) URL.revokeObjectURL(videoUrl);
          router.push("/");
        } catch (err: any) {
          console.error(err);
          const msg = err?.message ?? "Upload failed, please try again.";
          setProcessingError(msg);
          // Let UploadFlow know there was an error so it can stop the spinner
          throw new Error(msg);
        } finally {
          setProcessing(false);
        }
      }}
    />
  );
}


  // 3b) unified UploadFlow – IMAGES
  if (postFlow?.kind === "images") {
    return (
      <UploadFlow
        variant="images"
        images={postFlow.images}
        onCancel={() => setPostFlow(null)}
        onSubmit={async (formValues: any) => {
          try {
            const { successes, failures } = await uploadImagesBatch(
              postFlow.images.files,
              {
                title: undefined,
                description: formValues.description,
                audience: formValues.audience,
              }
            );

            console.log("Image upload successes:", successes);
            if (failures.length > 0) {
              console.warn("Some images failed to upload:", failures);
            }

            setPostFlow(null);
            setImageFiles([]);
            router.push("/");
          } catch (err: any) {
            console.error(err);
            alert(err?.message ?? "Image upload failed, please try again.");
          }
        }}
      />
    );
  }

  // 3c) bulk image summary – per-file uploadFn
  async function uploadImageToSupabase(
    file: File,
    onProgress: (p: number) => void
  ): Promise<string> {
    // For bulk uploads you can hard-code, or later let the user choose
    const row = await uploadSingleImage(file, {
      audience: "straight", // TODO: expose in BulkImageSummary if you want
      description: "",
      title: file.name,
    });

    // Supabase JS doesn't expose upload progress here, so we just mark 100% when done
    onProgress(100);

    // BulkImageSummary expects a string; storage_path is a good identifier
    return row.storage_path ?? "";
  }

  if (bulkFiles.length > 0) {
    return (
      <BulkImageSummary
        files={bulkFiles}
        onBack={() => setBulkFiles([])}
        uploadFn={uploadImageToSupabase}
      />
    );
  }

  // 4) picker UI
  return (
    <div className="relative min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
      {processing && (
        <div className="fixed bottom-4 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-white/15 bg-black/80 p-4 space-y-2 shadow-xl">
            <div className="flex justify-between text-xs text-white/80">
              <span>Processing video…</span>
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
      <header className="sticky top-0 z-10 flex items-center justify-center h-14 bg-black/80 backdrop-blur border-b border-white/10">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute left-4 rounded-full p-2 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Upload</h1>
      </header>

      <div className="mx-auto max-w-[680px] px-4 py-6">
        <p className="text-center text-white/90 text-base mb-6">
          Choose a file.
        </p>

        <Card className="bg-[#101010] border-white/15 rounded-3xl px-4 sm:px-6 py-6 space-y-4">
          <BigOutlineButton
            onClick={() => videoInputRef.current?.click()}
            icon={<FileVideo className="h-5 w-5" />}
            label="Select a Video"
          />

          <p className="flex text-sm text-red-500 ">
            We recommend videos lower than 50 MB for faster uploads           
            
          </p>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handlePickVideo}
          />

          {prepError && (
            <p className="text-xs text-red-400 px-2">{prepError}</p>
          )}

          <BigOutlineButton
            onClick={() => imageInputRef.current?.click()}
            icon={<ImagePlus className="h-5 w-5" />}
            label="Select Image"
          />

          
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickImages}
          />

          <p className="flex gap-2 text-sm text-white/70 mt-2 px-1">
            Users who are verified get more views and interaction.
            <Link
              href={"/verify"}
            >
            <button
              className="underline underline-offset-4 font-medium"
              style={{ color: ACCENT }}
              type="button"
            >
              Get verified.
            </button>
            </Link>
            
          </p>
        </Card>

        <div className="my-6 flex items-center gap-4">
          <Separator className="flex-1 bg-white/10" />
          <span className="text-white/80 text-sm">OR</span>
          <Separator className="flex-1 bg-white/10" />
        </div>

        <Card className="bg-[#101010] border-white/15 rounded-3xl px-4 sm:px-6 py-6 space-y-4">
          <p className="text-sm text-white/85 leading-relaxed">
            <span className="font-semibold">
              Bulk upload up to 50 images.
            </span>{" "}
          </p>

          <BigOutlineButton
            onClick={() => bulkInputRef.current?.click()}
            icon={<ImagePlus className="h-5 w-5" />}
            label="Bulk Upload Images"
          />
          <input
            ref={bulkInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              e.currentTarget.value = ""; // allow same selection twice
              setBulkFiles(selected.slice(0, 50)); // go to Bulk summary
            }}
          />
        </Card>
      </div>

      {isPreparing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur grid place-items-center">
          <div className="rounded-2xl border border-white/15 bg-black/80 px-6 py-5 flex items-center gap-3 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>
              {prepTarget === "video"
                ? "Preparing your video…"
                : prepTarget === "images"
                ? "Preparing your images…"
                : "Preparing your file(s)…"}
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
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      className="w-full h-14 rounded-[28px] border border-white/35 bg-black/30 hover:bg-white/10
                 justify-start px-4 text-base font-semibold text-white
                 flex items-center gap-3"
    >
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/10 border border-white/25">
        {icon}
      </span>
      {label}
    </Button>
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
    const t = setTimeout(() => reject(new Error("metadata-timeout")), timeoutMs);
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
