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

const ACCENT = "pink";

type PostFlow =
  | { kind: "video"; clip: ClipSelection }
  | { kind: "images"; images: ImageSelection }
  | null;


// Helper: send original clip + range to server, get a *trimmed* File back
async function trimOnServer(clip: ClipSelection): Promise<File> {
  const fd = new FormData();
  fd.append("file", clip.file);
  fd.append("start", String(clip.start));
  fd.append("end", String(clip.end));

  const res = await fetch("/api/trim-video", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Trim failed (${res.status}). ${text || ""}`);
  }

  const blob = await res.blob();

  // name the new file however you like
  const trimmedFileName =
    clip.file.name.replace(/\.[^.]+$/, "") + "-trimmed.mp4";

  const trimmedFile = new File([blob], trimmedFileName, {
    type: blob.type || "video/mp4",
  });

  return trimmedFile;
}


export default function UploadPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/home";

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
          try {
            // 1) get trimmed file from server
            const trimmedFile = await trimOnServer(postFlow.clip);

            // 2) build a new ClipSelection that uses the trimmed file
            const trimmedClip: ClipSelection = {
              ...postFlow.clip,
              file: trimmedFile,
              // duration on server stays end - start; but the file itself is trimmed
              start: 0,
              end: postFlow.clip.end - postFlow.clip.start,
            };

            // 3) upload trimmed video to Supabase
            const row = await uploadTrimmedVideo(trimmedClip, {
              title: formValues.description?.slice(0, 80) ?? "",
              description: formValues.description ?? "",
              audience: formValues.audience,
            });

            console.log("Inserted media row:", row);
            setPostFlow(null);
            setVideoFile(null);
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            router.push("/");
          } catch (err: any) {
            console.error(err);
            alert(err?.message ?? "Upload failed, please try again.");
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
          Choose a file or paste a URL below.
        </p>

        <Card className="bg-[#101010] border-white/15 rounded-3xl px-4 sm:px-6 py-6 space-y-4">
          <BigOutlineButton
            onClick={() => videoInputRef.current?.click()}
            icon={<FileVideo className="h-5 w-5" />}
            label="Select a Video"
          />
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

          <p className="text-sm text-white/70 mt-2 px-1">
            Uploading by URL is available to Verified creators only.{" "}
            <button
              className="underline underline-offset-4 font-medium"
              style={{ color: ACCENT }}
              type="button"
            >
              Get verified.
            </button>
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
