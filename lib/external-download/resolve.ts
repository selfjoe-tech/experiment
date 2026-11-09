import "server-only";
import { parseExternalVideoUrl, type ExternalPlatform, type ExternalVideoInfo, type VideoQuality } from "@/lib/external-download";

export type DownloadSource = { url: string; quality: VideoQuality; label: string; format?: "file" | "hls" };
export type ResolvedExternalVideo = ExternalVideoInfo & { sources: DownloadSource[] };

export class ExtractorError extends Error {
  constructor(message: string, public status = 422) { super(message); this.name = "ExtractorError"; }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const LEVELS: VideoQuality[] = [1080, 720, 480, 360, 240];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const txt = (v: unknown, max = 180): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const number = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function usableMediaUrl(input: unknown, context = ""): string | null {
  if (typeof input !== "string" || input.length > 4096) return null;
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (/^[0-9.]+$/.test(host) || host.includes(":") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (/\.(?:m3u8|mpd|m3u|jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i.test(url.href)) return null;
  if (/thumbnail|poster|cover|avatar|image|photo|preview/i.test(context)) return null;
  const extension = /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url.href);
  const stream = /(?:mime|content_type|format)=video(?:%2[fF]|\/|_)(?:mp4|webm)/i.test(url.search);
  const knownHost = host === "video.twimg.com" || /\.(?:redgifs\.com|phncdn\.com|phprcdn\.com)$/.test(host) || /(?:cdn|video|media|files|stream)/i.test(host);
  return extension || stream || (knownHost && /\b(video|play|download|hd|sd|media|source|file)\b/i.test(context)) ? url.href : null;
}

export function isSafeHlsSource(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (host === "phncdn.com" || host.endsWith(".phncdn.com") || host === "phprcdn.com" || host.endsWith(".phprcdn.com")) &&
      /\.m3u8$/i.test(url.pathname);
  } catch { return false; }
}

function guessQuality(entry: unknown, path = ""): VideoQuality {
  const value = obj(entry);
  const hint = [value.quality, value.resolution, value.height, value.label, path].filter(x => x !== null && x !== undefined).join(" ");
  const match = /(?:^|[^\d])(1080|720|480|360|240)(?:p|[^\d]|$)/i.exec(hint);
  if (match) return Number(match[1]) as VideoQuality;
  if (/\b(sd|low)\b/i.test(hint)) return 480;
  if (/\b(hd|high)\b/i.test(hint)) return 720;
  return "best";
}

function collectSources(payload: unknown): DownloadSource[] {
  const found: DownloadSource[] = [];
  const seen = new Set<string>();
  const walk = (value: unknown, context: string, depth: number) => {
    if (depth > 7 || found.length >= 24) return;
    if (typeof value === "string") {
      const url = usableMediaUrl(value, context);
      if (url && !seen.has(url)) {
        seen.add(url);
        found.push({ url, quality: guessQuality(null, context), label: context || "Video" });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 24).forEach((v, i) => walk(v, context + " " + i, depth + 1));
      return;
    }
    const entry = obj(value);
    const level = guessQuality(entry, context);
    for (const [key, v] of Object.entries(entry).slice(0, 64)) {
      if (/thumbnail|poster|cover|avatar|image|photo|preview/i.test(key)) continue;
      if (typeof v === "string") {
        const url = usableMediaUrl(v, context + " " + key);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        found.push({ url, quality: level === "best" ? guessQuality(null, key) : level, label: txt(entry.quality || entry.resolution || entry.label, 40) || key });
      } else if (v && typeof v === "object") {
        walk(v, context + " " + key, depth + 1);
      }
    }
  };
  walk(payload, "", 0);
  return found;
}

function makeResult(
  platform: ExternalPlatform,
  details: { title?: unknown; uploader?: unknown; duration?: unknown; thumbnail?: unknown },
  input: DownloadSource[],
): ResolvedExternalVideo {
  const seen = new Set<string>();
  const sources = input.filter(item => {
    if (!(item.format === "hls" ? isSafeHlsSource(item.url) : usableMediaUrl(item.url, "video")) || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).sort((a, b) => (b.quality === "best" ? 2000 : b.quality) - (a.quality === "best" ? 2000 : a.quality)).slice(0, 12);
  if (!sources.length) throw new ExtractorError(platform === "pornhub"
    ? "This Pornhub video only exposes HLS playlists, not a directly downloadable MP4. Converting HLS requires additional processing."
    :  "No downloadable video file was found. The post may be unavailable or restricted.");
  const q: VideoQuality[] = sources.map(source => source.quality);
  const thumb = txt(details.thumbnail, 4096);
  return {
    title: txt(details.title) || "Video from " + platform,
    uploader: txt(details.uploader, 100),
    duration: number(details.duration),
    thumbnail: thumb && /^https:\/\//.test(thumb) ? thumb : null,
    platform,
    qualities: ["best", ...LEVELS.filter(x => q.includes(x))],
    sources,
  };
}

async function deadline<T>(request: Promise<T>, timeoutMs = 18000): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<T>((_, reject) => { id = setTimeout(() => reject(new ExtractorError("The video source timed out.", 504)), timeoutMs); }),
    ]);
  } finally { if (id) clearTimeout(id); }
}

async function getJson(url: string, moreHeaders: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...moreHeaders },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new ExtractorError(
    response.status === 404 ? "The video was not found." : "The video provider did not return a usable response.",
    response.status === 429 ? 429 : 422,
  );
  return obj(await response.json());
}

async function viaFxTwitter(url: string): Promise<ResolvedExternalVideo> {
  const id = new URL(url).pathname.match(/\/status\/(\d+)/)?.[1];
  if (!id) throw new ExtractorError("Invalid X post.");
  const response = await getJson("https://api.fxtwitter.com/status/" + id);
  const tweet = obj(response.tweet);
  const media = obj(tweet.media);
  const videos = Array.isArray(media.videos) ? media.videos : [];
  const first = obj(videos[0]);
  const sources: DownloadSource[] = [];
  for (const item of videos.slice(0, 4)) {
    const video = obj(item);
    const formats = Array.isArray(video.formats) ? video.formats : [];
    for (const f of formats) {
      const variant = obj(f);
      if (variant.container !== "mp4" && !String(variant.url || "").includes(".mp4")) continue;
      const mediaUrl = usableMediaUrl(variant.url, "video");
      if (mediaUrl) sources.push({ url: mediaUrl, quality: guessQuality(variant, ""), label: String(variant.height || "Video") });
    }
    const primary = usableMediaUrl(video.url, "video");
    if (primary) sources.push({ url: primary, quality: guessQuality(video), label: "Video" });
  }
  const author = obj(tweet.author);
  return makeResult("x", {
    title: tweet.text, uploader: author.screen_name || author.name,
    duration: first.duration, thumbnail: first.thumbnail_url,
  }, sources);
}

async function viaBtch(url: string, platform: "x"): Promise<ResolvedExternalVideo> {
  const sdk = await import("btch-downloader");
  const data: unknown = await deadline(sdk.twitter(url));
  const root = obj(data);
  const inner = obj(root.data);
  const first = Array.isArray(root.data) ? obj(root.data[0]) : inner;
  return makeResult(platform, {
    title: root.title || inner.title || first.title || root.caption || first.caption,
    uploader: root.author || root.username || inner.username || first.username,
    duration: root.duration || inner.duration || first.duration,
    thumbnail: root.thumbnail || inner.thumbnail || first.thumbnail,
  }, collectSources(data));
}

async function viaRedgifs(url: string): Promise<ResolvedExternalVideo> {
  const id = new URL(url).pathname.match(/^\/watch\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) throw new ExtractorError("Invalid Redgifs URL.");
  const referer = { Referer: "https://www.redgifs.com/" };
  const tokenResult = await getJson("https://api.redgifs.com/v2/auth/temporary", referer);
  const token = txt(tokenResult.token, 4096);
  if (!token) throw new ExtractorError("Redgifs did not provide a temporary access token.");
  const response = await getJson("https://api.redgifs.com/v2/gifs/" + encodeURIComponent(id), { ...referer, Authorization: "Bearer " + token });
  const gif = obj(response.gif);
  const urls = obj(gif.urls);
  const sources: DownloadSource[] = [];
  const hd = usableMediaUrl(urls.hd, "video hd");
  const sd = usableMediaUrl(urls.sd, "video sd");
  if (hd) sources.push({ url: hd, quality: 720, label: "HD" });
  if (sd) sources.push({ url: sd, quality: 480, label: "SD" });
  return makeResult("redgifs", {
    title: gif.title || ("Redgifs " + id),
    uploader: gif.userName, duration: gif.duration,
    thumbnail: urls.poster || urls.thumbnail,
  }, sources);
}

async function viaPornhub(url: string): Promise<ResolvedExternalVideo> {
  const { PornHub } = await import("pornhub.js");
  const data = obj(await deadline(new PornHub().video(url)));
  const definitions = Array.isArray(data.mediaDefinitions) ? data.mediaDefinitions : [];
  const sources: DownloadSource[] = [];
  for (const candidate of definitions) {
    const entry = obj(candidate);
    const format = String(entry.format || "").toLowerCase();
    const value = typeof entry.videoUrl === "string" ? entry.videoUrl : "";
    const pathname = (() => {try{return new URL(value).pathname}catch{return ""}})();
    const match = /(?:^|[\/_])(?:1080|720|480|360|240)p(?:[_./]|$)/i.exec(pathname);
    const filenameQuality = match ? guessQuality(null, match[0]) : "best";
    const quality = filenameQuality !== "best" ? filenameQuality :
      typeof entry.quality === "number" ? guessQuality(entry) : "best";
    if (format === "mp4") {
      const mediaUrl = usableMediaUrl(value, "video");
      if (mediaUrl) sources.push({url: mediaUrl, quality, label: quality === "best" ? "MP4" : quality + "p", format: "file"});
    }
    if (format === "hls" && isSafeHlsSource(value)) {
      sources.push({url: value, quality, label: quality === "best" ? "HLS" : quality + "p", format: "hls"});
    }
  }
  if (sources.length === 0) throw new ExtractorError(
    "Pornhub is not exposing this video to Goongram. It may require a browser challenge or be restricted; try another public link.");
  return makeResult("pornhub", {
    title: data.title, uploader: obj(data.provider).username || data.author || data.username,
    duration: data.duration, thumbnail: data.thumb || data.thumbnail,
  }, sources);
}

export async function resolveExternalVideo(raw: unknown): Promise<ResolvedExternalVideo> {
  const parsed = parseExternalVideoUrl(raw);
  if (!parsed) throw new ExtractorError("Paste a valid public video post link.", 400);
  try {
    if (parsed.platform === "redgifs") return await viaRedgifs(parsed.url);
    if (parsed.platform === "pornhub") return await viaPornhub(parsed.url);
    try { return await viaBtch(parsed.url, "x"); }
    catch { return await viaFxTwitter(parsed.url); }
  } catch (error) {
    if (error instanceof ExtractorError) throw error;
    throw new ExtractorError("The video could not be extracted from this public post. Try another link.");
  }
}

export function selectSource(resolved: ResolvedExternalVideo, quality: VideoQuality): DownloadSource {
  if (quality === "best") return resolved.sources[0];
  const ranked = resolved.sources.filter(x => x.quality !== "best").sort((a,b) => Number(b.quality) - Number(a.quality));
  return ranked.find(x => Number(x.quality) <= quality) || ranked[ranked.length - 1] || resolved.sources[0];
}

export function isSafeProxySource(input: string, platform: ExternalPlatform) {
  const url = usableMediaUrl(input, "video");
  if (!url) return false;
  const host = new URL(url).hostname.toLowerCase();
  const suffix = (domain: string) => host === domain || host.endsWith("." + domain);
  if (platform === "x") return suffix("twimg.com");
  if (platform === "redgifs") return suffix("redgifs.com");
  return suffix("phncdn.com") || suffix("phprcdn.com");
}

export function downloadFilename(platform: ExternalPlatform, input: string) {
  const parsed = parseExternalVideoUrl(input);
  if (!parsed) return "goongram-video.mp4";
  const path = new URL(parsed.url).pathname;
  const id = (platform === "x" ? path.match(/\/status\/(\d+)/)?.[1] :
    platform === "pornhub" ? new URL(parsed.url).searchParams.get("viewkey") :
    path.split("/").filter(Boolean).pop()) || "video";
  return "goongram-" + platform + "-" + id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0,64) + ".mp4";
}

export const EXTRACTOR_USER_AGENT = UA;
