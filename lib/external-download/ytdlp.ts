import "server-only";

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";

const MAX_OUTPUT = 4 * 1024 * 1024;
const TIMEOUT_MS = 28000;

export type YtDlpFormat = {
  url?: unknown;
  ext?: unknown;
  protocol?: unknown;
  format_id?: unknown;
  height?: unknown;
  width?: unknown;
  vcodec?: unknown;
  acodec?: unknown;
  tbr?: unknown;
  format_note?: unknown;
  http_headers?: unknown;
};

export type YtDlpMetadata = {
  title?: unknown;
  uploader?: unknown;
  duration?: unknown;
  thumbnail?: unknown;
  formats?: unknown;
  url?: unknown;
  ext?: unknown;
  protocol?: unknown;
};

/**
 * Run the pinned official yt-dlp executable. URL validation is performed
 * by the caller, so arbitrary URLs are never passed into the subprocess.
 * No user cookies, proxy options, or authentication state are injected.
 */
export async function inspectWithYtDlp(url: string): Promise<YtDlpMetadata> {
  const binary = join(process.cwd(), "bin", "yt-dlp");
  try {
    const file = await stat(binary);
    if (!file.isFile()) throw new Error("not a file");
  } catch {
    throw new Error("YT_DLP_NOT_INSTALLED");
  }

  const args = [
    "--ignore-config",
    "--no-playlist",
    "--no-cache-dir",
    "--skip-download",
    "--dump-single-json",
    "--no-warnings",
    "--socket-timeout", "10",
    "--retries", "1",
    "--extractor-retries", "1",
    "--", url,
  ];

  return new Promise<YtDlpMetadata>((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let outputSize = 0;

    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, XDG_CACHE_HOME: "/tmp", HOME: "/tmp" },
    });
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGKILL");
      reject(error);
    };

    const timeout = setTimeout(() => fail(new Error("YT_DLP_TIMEOUT")), TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      outputSize += chunk.length;
      if (outputSize > MAX_OUTPUT) return fail(new Error("YT_DLP_METADATA_TOO_LARGE"));
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 2400) stderr += chunk.toString("utf8").slice(0, 2400 - stderr.length);
    });
    child.on("error", () => fail(new Error("YT_DLP_EXEC_FAILED")));
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        const blocked = /captcha|verify|sign in|challenge|blocked|http error 403|access denied/i.test(stderr);
        reject(new Error(blocked ? "YT_DLP_SOURCE_RESTRICTED" : "YT_DLP_EXTRACTION_FAILED"));
        return;
      }
      try {
        const result: unknown = JSON.parse(stdout);
        if (!result || typeof result !== "object" || Array.isArray(result)) throw Error("bad metadata");
        resolve(result as YtDlpMetadata);
      } catch {
        reject(new Error("YT_DLP_INVALID_RESPONSE"));
      }
    });
  });
}
