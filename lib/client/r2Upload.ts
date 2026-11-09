"use client";

/**
 * Direct-to-R2 upload; never send the file through Vercel.
 * Signed URL is scoped to a single path and MIME type for five minutes.
 */
export async function uploadFileToR2(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const response = await fetch("/api/r2-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const payload = await response.json() as {
    signedUrl?: string;
    publicUrl?: string;
    key?: string;
    contentType?: string;
    error?: string;
  };
  if (!response.ok || !payload.signedUrl || !payload.publicUrl || !payload.key) {
    throw new Error(payload.error || "Could not authorize R2 upload.");
  }

  onProgress?.(0);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", payload.signedUrl!, true);
    xhr.timeout = 300000;
    xhr.setRequestHeader("Content-Type", payload.contentType!);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(99, Math.floor(event.loaded / event.total * 99)));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading to R2."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.ontimeout = () => reject(new Error("R2 upload timed out."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 upload failed (HTTP ${xhr.status}).`));
    };
    xhr.send(file);
  });
  onProgress?.(99);
  const verified = await fetch("/api/r2-upload/complete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: payload.key, size: file.size, contentType: file.type }),
  });
  if (!verified.ok) {
    const data = await verified.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Could not verify R2 object.");
  }
  return payload.publicUrl;
}
