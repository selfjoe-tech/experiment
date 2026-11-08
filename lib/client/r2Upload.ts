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
    contentType?: string;
    error?: string;
  };
  if (!response.ok || !payload.signedUrl || !payload.publicUrl) {
    throw new Error(payload.error || "Could not authorize R2 upload.");
  }

  onProgress?.(0);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", payload.signedUrl!, true);
    xhr.timeout = 180000;
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
  return payload.publicUrl;
}
