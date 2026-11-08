"use client";

import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/client/r2Upload";

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

/** Direct Cloudflare R2 browser upload with actual byte progress. */
async function uploadToStorage(file: File, opts: ProgressOptions = {}): Promise<string> {
  opts.onStageChange?.("preparing");
  opts.onStageChange?.("uploading");
  const url = await uploadFileToR2(file, opts.onUploadProgress);
  opts.onStageChange?.("saving");
  return url;
}

async function insertMediaRow(params: {
  ownerId: string;
  mediaType: "video" | "image";
  audience: AudienceType;
  storagePath: string;
  title?: string;
  description?: string;
  durationSeconds?: number | null;
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

// ----------------- VIDEO -----------------

export async function uploadTrimmedVideo(
  clip: ClipSelection,
  form: VideoUploadFormValues,
  opts?: ProgressOptions & { durationSeconds?: number }
): Promise<InsertedMediaRow> {
  opts?.onUploadProgress?.(0);

  const ownerId = await requireCurrentUserId();
  const storagePath = await uploadToStorage(clip.file, opts);

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
  const storagePath = await uploadToStorage(file, opts);

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
      try {
        const storagePath = await uploadToStorage(file, {
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
