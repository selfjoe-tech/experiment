"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type AudienceType =
  | "straight"
  | "gay"
  | "trans"
  | "bisexual"
  | "lesbian"
  | "animated";

export type ClipSelection = {
  file: File;
  start: number;
  end: number;
  muted: boolean;
};

export type VideoUploadFormValues = {
  title?: string;
  description?: string;
  audience: AudienceType;
  tags?: string[];
};

export type ImageUploadFormValues = {
  title?: string;
  description?: string;
  audience: AudienceType;
  tags?: string[];
};

export type InsertedMediaRow = {
  id: number;
  storage_path?: string | null;
};

function getExt(file: File, fallback: string) {
  const extRaw = file.name.split(".").pop();
  return (extRaw && extRaw.toLowerCase()) || fallback;
}

function makeStoragePath(
  kind: "video" | "image",
  ownerId: string,
  file: File
) {
  const ext = getExt(file, kind === "video" ? "mp4" : "jpg");
  const random = crypto.randomUUID();
  const folder = kind === "video" ? "videos" : "images";

  return `${folder}/${ownerId}/${random}.${ext}`;
}

async function requireCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to upload media.");
  }

  return user.id;
}

type ProgressOptions = {
  onUploadProgress?: (pct: number) => void;
  onStageChange?: (stage: "preparing" | "uploading" | "saving") => void;
};

/** Signed Supabase Storage upload with actual browser byte progress. */
async function uploadToStorage(path: string, file: File, opts: ProgressOptions = {}): Promise<void> {
  opts.onStageChange?.("preparing");
  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not authorize upload.");

  const url = new URL(data.signedUrl);
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!project || url.origin !== new URL(project).origin ||
      !url.pathname.startsWith("/storage/v1/object/upload/sign/")) {
    throw new Error("Unexpected storage upload URL.");
  }

  opts.onStageChange?.("uploading");
  opts.onUploadProgress?.(0);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url.toString(), true);
    xhr.timeout = 180000;
    xhr.setRequestHeader("x-upsert", "false");
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        opts.onUploadProgress?.(Math.min(99, Math.floor(event.loaded / event.total * 99)));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Please retry."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please retry."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onUploadProgress?.(99);
        resolve();
        return;
      }
      let message = `Storage upload failed (HTTP ${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = body.message || body.error || message;
      } catch { /* keep HTTP message */ }
      reject(new Error(message));
    };
    xhr.send(body);
  });
  opts.onStageChange?.("saving");
}

async function insertMediaRow(params: {
  ownerId: string;
  mediaType: "video" | "image";
  audience: AudienceType;
  storagePath: string;
  title?: string;
  description?: string;
  durationSeconds?: number | null;
  thumbnailPath?: string | null;
  tags?: string[];
}): Promise<InsertedMediaRow> {
  const { data, error } = await supabase
    .from("media")
    .insert({
      owner_id: params.ownerId,
      media_type: params.mediaType,
      audience: params.audience,
      title: params.title ?? null,
      description: params.description ?? null,
      storage_path: params.storagePath,
      thumbnail_path: params.thumbnailPath ?? null,
      duration_seconds:
        typeof params.durationSeconds === "number"
          ? params.durationSeconds
          : null,
      tags: params.tags ?? [],
    })
    .select("id, storage_path")
    .single();

  if (error) {
    console.error("DB insert error", error);
    throw new Error(error.message || "Failed to create media record.");
  }

  return data as InsertedMediaRow;
}

/**
 * Capture a real, public video poster during the existing upload workflow.
 * Generating it locally avoids an expensive FFmpeg server job or third-party API.
 * Failure never blocks the underlying video upload.
 */
async function captureVideoPoster(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Poster timeout")), 10000);
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve();
      };
      const fail = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        reject(new Error("Cannot decode poster frame"));
      };
      video.onerror = fail;
      video.onloadeddata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0.3) return done();
        try {
          video.currentTime = Math.min(1, video.duration / 3);
        } catch { done(); }
      };
      video.onseeked = done;
      video.src = url;
      video.load();
    });
    if (!video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/jpeg", 0.78));
    return blob && blob.size > 0
      ? new File([blob], "video-poster.jpg", { type: "image/jpeg" })
      : null;
  } catch (error) {
    console.warn("Video poster could not be generated:", error);
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

// ----------------- VIDEO -----------------

export async function uploadTrimmedVideo(
  clip: ClipSelection,
  form: VideoUploadFormValues,
  opts?: ProgressOptions & { durationSeconds?: number }
): Promise<InsertedMediaRow> {
  opts?.onUploadProgress?.(0);

  const ownerId = await requireCurrentUserId();
  const storagePath = makeStoragePath("video", ownerId, clip.file);

  await uploadToStorage(storagePath, clip.file, opts);

  let thumbnailPath: string | null = null;
  try {
    const poster = await captureVideoPoster(clip.file);
    if (poster) {
      const posterPath = `posters/${ownerId}/${crypto.randomUUID()}.jpg`;
      await uploadToStorage(posterPath, poster);
      thumbnailPath = posterPath;
    }
  } catch (error) {
    console.warn("Video poster upload failed; original upload will continue:", error);
  }

  const durationSeconds =
    typeof opts?.durationSeconds === "number"
      ? opts.durationSeconds
      : Math.max(0, clip.end - clip.start);

  const row = await insertMediaRow({
    ownerId,
    mediaType: "video",
    audience: form.audience,
    title: form.title,
    description: form.description,
    storagePath,
    thumbnailPath,
    durationSeconds,
    tags: form.tags ?? [],
  });

  opts?.onUploadProgress?.(100);
  return row;
}

// ----------------- IMAGES -----------------

export async function uploadSingleImage(
  file: File,
  form: ImageUploadFormValues,
  opts?: ProgressOptions
): Promise<InsertedMediaRow> {
  opts?.onUploadProgress?.(0);

  const ownerId = await requireCurrentUserId();
  const storagePath = makeStoragePath("image", ownerId, file);

  await uploadToStorage(storagePath, file, opts);

  const row = await insertMediaRow({
    ownerId,
    mediaType: "image",
    audience: form.audience,
    title: form.title ?? file.name,
    description: form.description,
    storagePath,
    tags: form.tags ?? [],
  });

  opts?.onUploadProgress?.(100);
  return row;
}

export async function uploadImagesBatch(
  files: File[],
  form: ImageUploadFormValues,
  opts: ProgressOptions = {}
): Promise<{
  successes: { index: number; id: number; storage_path?: string | null }[];
  failures: { index: number; error: string }[];
}> {
  const successes: { index: number; id: number; storage_path?: string | null }[] = [];
  const failures: { index: number; error: string }[] = [];
  if (!files.length) return { successes, failures };

  opts.onStageChange?.("preparing");
  const ownerId = await requireCurrentUserId();
  const bytes = files.map(() => 0);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
  let nextIndex = 0;
  let lastReported = 0;

  const report = (index: number, pct: number) => {
    bytes[index] = Math.max(bytes[index],
      Math.round(files[index].size * Math.min(100, Math.max(0, pct)) / 100));
    const doneBytes = bytes.reduce((sum, count) => sum + count, 0);
    const actual = Math.min(99, Math.floor(doneBytes / totalBytes * 99));
    lastReported = Math.max(lastReported, actual);
    opts.onUploadProgress?.(lastReported);
  };

  opts.onStageChange?.("uploading");
  opts.onUploadProgress?.(0);
  // Three workers avoid making as many as fifty simultaneous network requests.
  async function worker() {
    while (nextIndex < files.length) {
      const i = nextIndex++;
      const file = files[i];
      const storagePath = makeStoragePath("image", ownerId, file);
      try {
        await uploadToStorage(storagePath, file, {
          onUploadProgress: pct => report(i, pct),
        });
        report(i, 100);
        const row = await insertMediaRow({
          ownerId, mediaType: "image", audience: form.audience,
          title: form.title ?? file.name, description: form.description,
          storagePath, tags: form.tags ?? [],
        });
        successes.push({ index: i, id: row.id, storage_path: row.storage_path });
      } catch (error) {
        failures.push({ index: i,
          error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(files.length, 3) }, () => worker()));
  opts.onStageChange?.("saving");
  if (!failures.length) opts.onUploadProgress?.(100);
  successes.sort((a, b) => a.index - b.index);
  failures.sort((a, b) => a.index - b.index);
  return { successes, failures };
}
