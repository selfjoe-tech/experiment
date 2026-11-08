"""Goongram isolated yt-dlp worker. Public links only; no DRM or login bypass."""
import asyncio
import hashlib
import hmac
import os
import re
import shutil
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

import yt_dlp
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.background import BackgroundTask
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
SECRET = os.environ.get("VIDEO_DOWNLOADER_SECRET", "")
if len(SECRET) < 32:
    raise RuntimeError("VIDEO_DOWNLOADER_SECRET must contain at least 32 characters")

HOSTS = {
    "x.com": "x", "www.x.com": "x", "mobile.x.com": "x",
    "twitter.com": "x", "www.twitter.com": "x", "mobile.twitter.com": "x",
    "instagram.com": "instagram", "www.instagram.com": "instagram",
    "m.instagram.com": "instagram",
    "pornhub.com": "pornhub", "www.pornhub.com": "pornhub", "m.pornhub.com": "pornhub",
    "redgifs.com": "redgifs", "www.redgifs.com": "redgifs",
}
MAX_BYTES = 250 * 1024 * 1024
MAX_DURATION = 20 * 60
SLOTS = threading.BoundedSemaphore(2)
QUALITIES = ("best", "1080", "720", "480", "360", "240")


class InspectRequest(BaseModel):
    url: str


def validate_url(raw: str) -> tuple[str, str]:
    if not isinstance(raw, str) or len(raw) > 2048:
        raise HTTPException(400, "Invalid video URL.")
    try:
        parsed = urlsplit(raw.strip())
    except ValueError:
        raise HTTPException(400, "Invalid video URL.")
    host = (parsed.hostname or "").lower()
    platform = HOSTS.get(host)
    if (
        parsed.scheme != "https" or not platform or parsed.username
        or parsed.password or parsed.port is not None
    ):
        raise HTTPException(400, "Only public links from the four supported sites are allowed.")

    path = parsed.path
    valid = (
        bool(re.match(r"^/(?:[^/]+/status/\d+|i/status/\d+)(?:/|$)", path, re.I))
        if platform == "x" else
        bool(re.fullmatch(r"/(?:p|reel|tv)/[^/]+/?", path, re.I))
        if platform == "instagram" else
        (path == "/view_video.php" and "viewkey=" in parsed.query)
        if platform == "pornhub" else
        bool(re.fullmatch(r"/watch/[^/]+/?", path, re.I))
    )
    if not valid:
        raise HTTPException(400, "Paste a link to an individual video, not a profile or playlist.")
    return raw, platform


def options(**extra):
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 12,
        "retries": 1,
        "fragment_retries": 1,
        "ignoreerrors": False,
        "skip_unavailable_fragments": False,
        "playlist_items": "1",
        "extractor_args": {},
        **extra,
    }


def metadata(url: str) -> dict:
    with yt_dlp.YoutubeDL(options(skip_download=True)) as ydl:
        info = ydl.extract_info(url, download=False)
    if not isinstance(info, dict):
        raise ValueError("Video not found.")
    # A single video is required. Reject media sets and galleries.
    if info.get("_type") in ("playlist", "multi_video"):
        raise ValueError("Please provide a link to one video.")
    duration = info.get("duration")
    if isinstance(duration, (int, float)) and duration > MAX_DURATION:
        raise ValueError("Videos longer than 20 minutes are not supported.")

    heights = {
        int(f["height"]) for f in info.get("formats", [])
        if isinstance(f, dict)
        and f.get("vcodec") not in (None, "none")
        and isinstance(f.get("height"), (int, float))
    }
    qualities = ["best"] + [
        int(q) for q in QUALITIES[1:] if any(height >= int(q) for height in heights)
    ]
    return {
        "title": str(info.get("title") or "Untitled video")[:180],
        "uploader": str(info.get("uploader") or "")[:100] or None,
        "duration": duration if isinstance(duration, (int, float)) else None,
        "thumbnail": info.get("thumbnail") if str(info.get("thumbnail") or "").startswith("https://") else None,
        "qualities": qualities,
    }


def error_message(exc: Exception) -> str:
    message = str(exc).lower()
    if any(word in message for word in ("login", "sign in", "private", "cookies", "age", "403", "401")):
        return "This video requires authentication or is restricted. Only public videos are supported."
    if "longer than" in message:
        return "Videos longer than 20 minutes are not supported."
    if "larger than" in message or "file is larger" in message or "file size" in message:
        return "This video is larger than the 250 MB download limit."
    return "This video could not be downloaded. It may be unavailable or the site may have changed."


def format_selection(quality: str) -> str:
    if quality == "best":
        return "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b"
    h = int(quality)
    return (
        f"bv*[height<={h}][ext=mp4]+ba[ext=m4a]/"
        f"b[height<={h}][ext=mp4]/"
        f"bv*[height<={h}]+ba/b[height<={h}]"
    )


def save_file(url: str, quality: str, directory: str) -> tuple[str, str]:
    # Recheck duration before downloading; a signed URL is not proof of inspection.
    metadata(url)

    def limit_size(progress):
        size = progress.get("downloaded_bytes") or 0
        if size > MAX_BYTES:
            raise yt_dlp.utils.DownloadError("File is larger than 250 MB.")

    output = os.path.join(directory, "%(id).80s.%(ext)s")
    with yt_dlp.YoutubeDL(options(
        skip_download=False,
        outtmpl=output,
        format=format_selection(quality),
        merge_output_format="mp4",
        restrictfilenames=True,
        max_filesize=MAX_BYTES,
        progress_hooks=[limit_size],
    )) as ydl:
        info = ydl.extract_info(url, download=True)

    files = [
        p for p in Path(directory).iterdir()
        if p.is_file() and p.suffix.lower() in (".mp4", ".mkv", ".webm", ".mov")
        and p.stat().st_size > 0
    ]
    if not files:
        raise ValueError("The downloaded video file could not be prepared.")
    file = max(files, key=lambda p: p.stat().st_size)
    if file.stat().st_size > MAX_BYTES:
        raise ValueError("The file is larger than 250 MB.")
    title = str(info.get("title") if isinstance(info, dict) else "video")
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", title).strip("-")[:65] or "video"
    return str(file), f"goongram-{clean}{file.suffix.lower()}"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/inspect")
async def inspect(body: InspectRequest, authorization: str | None = Header(default=None)):
    if not hmac.compare_digest(authorization or "", f"Bearer {SECRET}"):
        raise HTTPException(401, "Unauthorized")
    url, _ = validate_url(body.url)
    if not SLOTS.acquire(blocking=False):
        raise HTTPException(429, "The downloader is busy. Please try again shortly.")
    try:
        try:
            return await asyncio.to_thread(metadata, url)
        except Exception as exc:
            raise HTTPException(422, error_message(exc)) from None
    finally:
        SLOTS.release()


@app.get("/download")
async def download(
    url: str = Query(..., max_length=2048),
    quality: str = Query("best"),
    expires: int = Query(...),
    signature: str = Query(..., min_length=64, max_length=64),
):
    url, _ = validate_url(url)
    if quality not in QUALITIES or expires < time.time() or expires > time.time() + 180:
        raise HTTPException(403, "Download link expired or invalid.")
    message = f"{url}\n{quality}\n{expires}".encode()
    expected = hmac.new(SECRET.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(403, "Invalid download link.")
    if not SLOTS.acquire(blocking=False):
        raise HTTPException(429, "The downloader is busy. Please try again shortly.")

    directory = tempfile.mkdtemp(prefix="goongram-download-")
    try:
        try:
            path, name = await asyncio.to_thread(save_file, url, quality, directory)
        except Exception as exc:
            raise HTTPException(422, error_message(exc)) from None
        suffix = Path(path).suffix.lower()
        mime = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
            ".mkv": "video/x-matroska",
        }.get(suffix, "application/octet-stream")
        return FileResponse(
            path, filename=name, media_type=mime,
            background=BackgroundTask(shutil.rmtree, directory, ignore_errors=True),
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        raise
    finally:
        SLOTS.release()
