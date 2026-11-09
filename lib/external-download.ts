export const EXTERNAL_VIDEO_PLATFORMS = [
  { name: "X / Twitter", key: "x" },
  { name: "Pornhub", key: "pornhub" },
  { name: "Redgifs", key: "redgifs" },
] as const;

export type ExternalPlatform = (typeof EXTERNAL_VIDEO_PLATFORMS)[number]["key"];
export type VideoQuality = "best" | 1080 | 720 | 480 | 360 | 240;

export type ExternalVideoInfo = {
  title: string;
  uploader: string | null;
  duration: number | null;
  thumbnail: string | null;
  platform: ExternalPlatform;
  qualities: VideoQuality[];
};

const ALLOWED_HOSTS: Record<string, ExternalPlatform> = {
  "x.com": "x",
  "www.x.com": "x",
  "mobile.x.com": "x",
  "twitter.com": "x",
  "www.twitter.com": "x",
  "mobile.twitter.com": "x",
  "pornhub.com": "pornhub",
  "www.pornhub.com": "pornhub",
  "m.pornhub.com": "pornhub",
  "redgifs.com": "redgifs",
  "www.redgifs.com": "redgifs",
};

export function parseExternalVideoUrl(value: unknown): {
  url: string;
  platform: ExternalPlatform;
} | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !ALLOWED_HOSTS[parsed.hostname.toLowerCase()]
  ) return null;

  // Only individual video/post URLs; never allow profile, playlist or search
  // links to trigger large automated batch downloads.
  const path = parsed.pathname;
  const platform = ALLOWED_HOSTS[parsed.hostname.toLowerCase()];
  const allowed =
    platform === "x" ? /^\/(?:[^/]+\/status\/\d+|i\/status\/\d+)(?:\/|$)/i.test(path)
    : platform === "pornhub" ? path === "/view_video.php" && Boolean(parsed.searchParams.get("viewkey"))
    : /^\/watch\/[^/]+\/?$/i.test(path);

  if (!allowed) return null;
  parsed.hash = "";
  return { url: parsed.toString(), platform };
}
