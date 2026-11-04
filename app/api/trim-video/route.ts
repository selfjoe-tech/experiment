// app/api/trim-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { getFfmpegPath } from "@/lib/ffmpegServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STAGING_BUCKET = "uploads-staging";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
    }

    const inBucket = String(body.inBucket ?? "");
    const inPath = String(body.inPath ?? "");
    const outBucket = String(body.outBucket ?? inBucket);
    const startSec = Number(body.startSec);
    const endSec = Number(body.endSec);
    const cleanupInput = body.cleanupInput === true;

    // Never accept arbitrary buckets or object paths for service-role storage access.
    const ownedInputPrefix = `trim/in/${user.id}/`;
    if (
      inBucket !== STAGING_BUCKET ||
      outBucket !== STAGING_BUCKET ||
      !inPath.startsWith(ownedInputPrefix) ||
      inPath.includes("..")
    ) {
      return NextResponse.json({ error: "Invalid staging object." }, { status: 403 });
    }

    if (
      !Number.isFinite(startSec) ||
      !Number.isFinite(endSec) ||
      startSec < 0 ||
      endSec <= startSec ||
      endSec - startSec > 600
    ) {
      return NextResponse.json({ error: "Invalid trim range." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const download = await supabase.storage.from(STAGING_BUCKET).download(inPath);

    if (download.error || !download.data) {
      return NextResponse.json({ error: "Could not load the staged video." }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await download.data.arrayBuffer());
    if (!inputBuffer.length || inputBuffer.length > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video must be 50 MB or smaller." }, { status: 413 });
    }

    const id = crypto.randomUUID();
    inputPath = path.join(os.tmpdir(), `trim-in-${id}.mp4`);
    outputPath = path.join(os.tmpdir(), `trim-out-${id}.mp4`);
    await fs.writeFile(inputPath, inputBuffer);

    const duration = Math.max(0.001, endSec - startSec);
    const args = [
      "-hide_banner",
      "-y",
      "-ss",
      String(startSec),
      "-i",
      inputPath,
      "-t",
      String(duration),
      "-c",
      "copy",
      "-movflags",
      "faststart",
      outputPath,
    ];

    await runFfmpeg(getFfmpegPath(), args);

    const trimmedBuffer = await fs.readFile(outputPath);
    if (!trimmedBuffer.length || trimmedBuffer.length > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: "The trimmed video is empty or exceeds 50 MB." },
        { status: 413 }
      );
    }

    const outPath = `trim/out/${user.id}/${Date.now()}-${id}.mp4`;
    const upload = await supabase.storage.from(STAGING_BUCKET).upload(
      outPath,
      trimmedBuffer,
      { contentType: "video/mp4", upsert: false }
    );

    if (upload.error) {
      throw new Error(`Could not upload the trimmed video: ${upload.error.message}`);
    }

    const signed = await supabase.storage
      .from(STAGING_BUCKET)
      .createSignedUrl(outPath, 60 * 15);

    if (signed.error || !signed.data?.signedUrl) {
      await supabase.storage.from(STAGING_BUCKET).remove([outPath]);
      throw new Error("Could not create a download link for the trimmed video.");
    }

    if (cleanupInput) {
      const { error: removeError } = await supabase.storage
        .from(STAGING_BUCKET)
        .remove([inPath]);

      if (removeError) {
        console.error("trim-video cleanup warning", removeError.message);
      }
    }

    return NextResponse.json(
      {
        outBucket: STAGING_BUCKET,
        outPath,
        downloadUrl: signed.data.signedUrl,
        startSec,
        endSec,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("trim-video error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video trimming failed." },
      { status: 500 }
    );
  } finally {
    if (inputPath) safeUnlink(inputPath);
    if (outputPath) safeUnlink(outputPath);
  }
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    child.stderr.on("data", (data) => console.error("[ffmpeg]", data.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

function safeUnlink(filePath: string) {
  fs.unlink(filePath).catch(() => {});
}
