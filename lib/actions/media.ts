// lib/actions/media.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * Must match your SQL enum:
 *   create type audience_type as enum (
 *     'straight','gay','trans','bisexual','lesbian','animated'
 *   );
 */
export type AudienceType =
  | "straight"
  | "gay"
  | "trans"
  | "bisexual"
  | "lesbian"
  | "animated";

export type VideoUploadFormValues = {
  title?: string;
  description?: string;
  audience: AudienceType;
};

export type ImageUploadFormValues = {
  title?: string;
  description?: string;
  audience: AudienceType;
};

// Should match what VideoTrimEditor passes to UploadFlow
export type ClipSelection = {
  file: File;
  start: number;
  end: number;
  muted: boolean;
};

type InsertedMediaRow = {
  id: number;
  storage_path?: string | null;
};

// ----------------- helpers -----------------

async function getCurrentUserId(): Promise<string> {
  

  return "2d78c663-73dc-4cc1-88e1-a113cc0fc47d";
}

function makeStoragePath(
  kind: "video" | "image",
  ownerId: string,
  file: File
): string {
  const extRaw = file.name.split(".").pop();
  const ext =
    (extRaw && extRaw.toLowerCase()) || (kind === "video" ? "mp4" : "jpg");

  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const folder = kind === "video" ? "videos" : "images";
  return `${folder}/${ownerId}/${random}.${ext}`;
}

async function uploadToStorage(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("Storage upload error", error);
    throw new Error("Failed to upload file to storage.");
  }
}

async function insertMediaRow(params: {
  ownerId: string;
  mediaType: "video" | "image";
  audience: AudienceType;
  storagePath: string;
  title?: string;
  description?: string;
  durationSeconds?: number;
  width?: number | null;
  height?: number | null;
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
      width:
        typeof params.width === "number" ? params.width : params.width ?? null,
      height:
        typeof params.height === "number" ? params.height : params.height ?? null,
    })
    .select("id, storage_path")
    .single();

  if (error) {
    console.error("DB insert error", error);
    throw new Error("Failed to create media record.");
  }

  return data as InsertedMediaRow;
}

// ----------------- VIDEO: trimmed upload -----------------

export async function uploadTrimmedVideo(
  clip: ClipSelection,
  form: VideoUploadFormValues
): Promise<InsertedMediaRow> {

    const sizeMB = clip.file.size / (1024 * 1024);
        console.log(
        "[uploadTrimmedVideo] final file size:",
        clip.file.size,
        "bytes",
        `(${sizeMB.toFixed(2)} MB)`
        );
  const ownerId = "2d78c663-73dc-4cc1-88e1-a113cc0fc47d"

  const storagePath = makeStoragePath("video", ownerId, clip.file);

  await uploadToStorage(storagePath, clip.file);

  const durationSeconds = Math.max(0, clip.end - clip.start);

  const row = await insertMediaRow({
    ownerId,
    mediaType: "video",
    audience: form.audience,
    title: form.title,
    description: form.description,
    storagePath,
    durationSeconds,
  });

  return row;
}

// ----------------- IMAGES: single + bulk -----------------

export async function uploadSingleImage(
  file: File,
  form: ImageUploadFormValues
): Promise<InsertedMediaRow> {
  const ownerId = "2d78c663-73dc-4cc1-88e1-a113cc0fc47d";
  const storagePath = makeStoragePath("image", ownerId, file);

  await uploadToStorage(storagePath, file);

  const row = await insertMediaRow({
    ownerId,
    mediaType: "image",
    audience: form.audience,
    title: form.title ?? file.name,
    description: form.description,
    storagePath,
  });

  return row;
}

export type BulkImageUploadResult = {
  successes: { index: number; id: number; storage_path?: string | null }[];
  failures: { index: number; error: string }[];
};

export async function uploadImagesBatch(
  files: File[],
  form: ImageUploadFormValues
): Promise<BulkImageUploadResult> {
  const ownerId = "2d78c663-73dc-4cc1-88e1-a113cc0fc47d";

  const results: BulkImageUploadResult = {
    successes: [],
    failures: [],
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const storagePath = makeStoragePath("image", ownerId, file);
      await uploadToStorage(storagePath, file);

      const row = await insertMediaRow({
        ownerId,
        mediaType: "image",
        audience: form.audience,
        title: form.title ?? file.name,
        description: form.description,
        storagePath,
      });

      results.successes.push({
        index: i,
        id: row.id,
        storage_path: row.storage_path,
      });
    } catch (err: any) {
      console.error("Bulk image upload failed", err);
      results.failures.push({
        index: i,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return results;
}
