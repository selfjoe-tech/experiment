import "server-only";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import ffmpeg from "ffmpeg-static";
import { EXTRACTOR_USER_AGENT, isSafeHlsSource } from "@/lib/external-download/resolve";

export async function streamHlsAsMp4(
  source: string,
  filename: string,
  signal: AbortSignal,
): Promise<Response> {
  if (!isSafeHlsSource(source)) {
    return Response.json({ error: "The HLS source is not permitted." }, { status: 422 });
  }

  if (!ffmpeg) return Response.json({ error: "FFmpeg is not installed on the processing function." }, { status: 503 });
  try { await stat(ffmpeg); }
  catch { return Response.json({ error: "The FFmpeg binary is unavailable." }, { status: 503 }); }

  // Stream-copy existing H.264/AAC video and audio into a fragmented MP4.
  // This does not decode/re-encode, upload or persist the source video.
  const args = [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-user_agent", EXTRACTOR_USER_AGENT,
    "-referer", "https://www.pornhub.com/",
    "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
    "-rw_timeout", "20000000",
    "-i", source,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-c", "copy",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1",
  ];
  const child = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    if (stderr.length < 1000) stderr += chunk.toString().slice(0, 1000);
  });

  const abort = () => child.kill("SIGKILL");
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });

  const iterator = child.stdout[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const first = await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<Buffer>>((_, reject) => {
        timer = setTimeout(() => reject(new Error("FFmpeg did not provide MP4 data before the timeout.")), 25000);
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (first.done || !first.value?.length) throw new Error("FFmpeg could not open the HLS playlist.");
    // Streaming responses avoid Vercel's buffered 4.5 MB response limit.
    let firstPending: Buffer | null = first.value;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (firstPending) {
            controller.enqueue(new Uint8Array(firstPending));
            firstPending = null;
            return;
          }
          const item = await iterator.next();
          if (item.done) {
            controller.close();
            signal.removeEventListener("abort", abort);
            return;
          }
          controller.enqueue(new Uint8Array(item.value));
        } catch (err) {
          controller.error(err);
          abort();
        }
      },
      cancel() {
        signal.removeEventListener("abort", abort);
        abort();
      },
    });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="' + filename.replace(/[^a-zA-Z0-9._-]/g, "-") + '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    if (timer) clearTimeout(timer);
    abort();
    signal.removeEventListener("abort", abort);
    // Do not expose signed URLs, FFmpeg command line or verbose remote output.
    return Response.json({
      error: "The HLS video could not be converted. The source might be restricted or unavailable.",
    }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
