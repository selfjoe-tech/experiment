// Install the pinned official yt-dlp Linux executable at build time.
// Verifies the artifact's SHA-256; no executable is fetched at request time.
import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const version = "2026.10.26";
const expectedSha256 = "767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795";

if (process.platform !== "linux" || process.arch !== "x64") {
  console.log("[yt-dlp] Skipping Linux executable installation on this architecture.");
  process.exit(0);
}

const url = "https://github.com/yt-dlp/yt-dlp/releases/download/" + version + "/yt-dlp_linux";
const destination = path.join(process.cwd(), "bin", "yt-dlp");
const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error("[yt-dlp] Official release download failed (HTTP " + response.status + ").");
const contentLength = Number(response.headers.get("content-length") || 0);
if (contentLength > 60_000_000) throw new Error("[yt-dlp] Unexpectedly large binary.");
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 1_000_000 || bytes.length > 60_000_000) {
  throw new Error("[yt-dlp] Invalid release binary length.");
}
const actual = createHash("sha256").update(bytes).digest("hex");
if (actual !== expectedSha256) throw new Error("[yt-dlp] Binary verification failed: checksum does not match pinned release.");

await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, bytes, { mode: 0o755 });
await chmod(destination, 0o755);
console.log("[yt-dlp] Installed verified yt-dlp " + version + " for Vercel.");
