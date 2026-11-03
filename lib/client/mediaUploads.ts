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

async function uploadToStorage(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    console.error("Storage upload error", error);
    throw new Error(error.message || "Failed to upload file to storage.");
  }
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
  opts?: { onUploadProgress?: (pct: number) => void; durationSeconds?: number }
): Promise<InsertedMediaRow> {
  // Supabase upload() does not expose byte-level upload progress.
  opts?.onUploadProgress?.(0);

  const ownerId = await requireCurrentUserId();
  const storagePath = makeStoragePath("video", ownerId, clip.file);

  await uploadToStorage(storagePath, clip.file);

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
  opts?: { onUploadProgress?: (pct: number) => void }
): Promise<InsertedMediaRow> {
  opts?.onUploadProgress?.(0);

  const ownerId = await requireCurrentUserId();
  const storagePath = makeStoragePath("image", ownerId, file);

  await uploadToStorage(storagePath, file);

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
  form: ImageUploadFormValues
): Promise<{
  successes: { index: number; id: number; storage_path?: string | null }[];
  failures: { index: number; error: string }[];
}> {
  const successes: { index: number; id: number; storage_path?: string | null }[] =
    [];
  const failures: { index: number; error: string }[] = [];

  const ownerId = await requireCurrentUserId();

  for (let i = 0; i < files.length; i++) {
    try {
      const file = files[i];
      const storagePath = makeStoragePath("image", ownerId, file);

      await uploadToStorage(storagePath, file);

      const row = await insertMediaRow({
        ownerId,
        mediaType: "image",
        audience: form.audience,
        title: form.title ?? file.name,
        description: form.description,
        storagePath,
        tags: form.tags ?? [],
      });

      successes.push({ index: i, id: row.id, storage_path: row.storage_path });
    } catch (error) {
      failures.push({
        index: i,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { successes, failures };
}
