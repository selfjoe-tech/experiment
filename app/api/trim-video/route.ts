// app/api/trim-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { getFfmpegPath } from "@/lib/ffmpegServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs";

// (Optional) helps on some platforms; ignore if you don't need it.
// export const maxDuration = 60;

type TrimReq = {
  inBucket: string;
  inPath: string;
  startSec: number;
  endSec: number;
  outBucket?: string;
  cleanupInput?: boolean;
};

export async function POST(req: NextRequest) {
  try {
let body: any;
try {
  body = await req.json();
} catch {
  return NextResponse.json(
    {
      error:
        "Expected JSON body. Your client is sending multipart/form-data. Update trimOnServer() to send JSON (storage path + times), not the raw file.",
    },
    { status: 415 }
  );
}
    const supabase = getSupabaseAdmin();
    const inBucket = body.inBucket;
    const inPath = body.inPath;
    const startSec = Number(body.startSec);
    const endSec = Number(body.endSec);
    const outBucket = body.outBucket || inBucket;
    const cleanupInput = !!body.cleanupInput;

    if (!inBucket || !inPath) {
      return NextResponse.json({ error: "Missing inBucket/inPath" }, { status: 400 });
    }

    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
      return NextResponse.json({ error: "Invalid start/end times" }, { status: 400 });
    }


    // 1) Download input from Storage
    const dl = await supabase.storage.from(inBucket).download(inPath);
    console.log(dl, "<<<<<<<<<<<<<< dl")
    if (dl.error || !dl.data) {
      throw new Error(`Failed to download input: ${dl.error?.message || "no data"}`);
    }

    const inputBuf = Buffer.from(await dl.data.arrayBuffer());

    // 2) Write to /tmp
    const tmpDir = os.tmpdir();
    const id = crypto.randomUUID();
    const inputPath = path.join(tmpDir, `trim-in-${id}.mp4`);
    const outputPath = path.join(tmpDir, `trim-out-${id}.mp4`);
    await fs.writeFile(inputPath, inputBuf);

    // 3) Run ffmpeg trim
    const ffmpegBin = getFfmpegPath();
    console.log(ffmpegBin, "<<<<<<<<<<<<, ffmpegbin")

    // Use -t (duration) instead of -to to avoid "full video" edge cases
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

    await runFfmpeg(ffmpegBin, args);

    // 4) Read output
    const trimmedBuffer = await fs.readFile(outputPath);
    if (!trimmedBuffer.length) throw new Error("ffmpeg produced empty output");

    // 5) Upload output to Storage
    const outPath = `trim/out/${Date.now()}-${id}.mp4`;

    const up = await supabase.storage.from(outBucket).upload(outPath, trimmedBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

    if (up.error) throw new Error(`Failed to upload output: ${up.error.message}`);

    // 6) Signed URL for client to download (so client can return a File)
    const signed = await supabase.storage.from(outBucket).createSignedUrl(outPath, 60 * 15);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(`Failed to create signed url: ${signed.error?.message || "no url"}`);
    }

    // 7) Cleanup temp files
    safeUnlink(inputPath);
    safeUnlink(outputPath);

    // Optional: remove input object
    if (cleanupInput) {
      supabase.storage.from(inBucket).remove([inPath]).catch(() => {});
    }

    return NextResponse.json(
      {
        outBucket,
        outPath,
        downloadUrl: signed.data.signedUrl,
        startSec,
        endSec,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("trim-video error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);

    child.stderr.on("data", (data) => console.log("[ffmpeg]", data.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

function safeUnlink(p: string) {
  fs.unlink(p).catch(() => {});
}
