"use client";

type ClipLike = { file: File; start: number; end: number };

type StageResp = {
  bucket: string;
  objectName: string;
  signedUrl: string;
  token: string;
  contentType: string;
};

async function stageUploadViaSignedUrl(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ inBucket: string; inPath: string }> {
  const stageRes = await fetch("/api/stage-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "video/mp4",
      bucket: "uploads-staging",
    }),
  });

  if (!stageRes.ok) {
    const t = await stageRes.text().catch(() => "");
    throw new Error(`Stage upload URL failed (${stageRes.status}). ${t}`);
  }

  const { bucket, objectName, signedUrl, contentType } =
    (await stageRes.json()) as StageResp;

  onProgress?.(10);

  // Upload the raw file to the signed URL (no session required)
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || file.type || "video/mp4",
      "x-upsert": "true",
    },
    body: file,
  });

  if (!put.ok) {
    const t = await put.text().catch(() => "");
    throw new Error(`Signed upload failed (${put.status}). ${t}`);
  }

  onProgress?.(55);
  return { inBucket: bucket, inPath: objectName };
}

export async function trimOnServer(
  clip: ClipLike,
  onProgress?: (pct: number) => void
): Promise<File> {
  onProgress?.(5);

  // 1) Stage original upload
  const { inBucket, inPath } = await stageUploadViaSignedUrl(clip.file, onProgress);

  // 2) Ask server to trim (JSON)
  const res = await fetch("/api/trim-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inBucket,
      inPath,
      startSec: clip.start,
      endSec: clip.end,
      outBucket: inBucket,
      cleanupInput: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Trim failed (${res.status}). ${text || ""}`);
  }

  const json = (await res.json()) as { downloadUrl: string };

  onProgress?.(70);

  // 3) Download trimmed file and return as File
  const dl = await fetch(json.downloadUrl);
  if (!dl.ok) throw new Error(`Failed to download trimmed file (${dl.status})`);

  onProgress?.(85);

  const blob = await dl.blob();
  const trimmedName = clip.file.name.replace(/\.[^.]+$/, "") + "-trimmed.mp4";

  onProgress?.(90);

  return new File([blob], trimmedName, { type: blob.type || "video/mp4" });
}
