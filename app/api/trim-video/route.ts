// app/api/trim-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getFfmpegPath } from "@/lib/ffmpegServer";

export const runtime = "nodejs"; // IMPORTANT: Node, not Edge

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const startSec = Number(formData.get("start"));
    const endSec = Number(formData.get("end"));

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
      return NextResponse.json(
        { error: "Invalid start/end times" },
        { status: 400 }
      );
    }

    const ffmpegBin = getFfmpegPath();
    console.log("Using ffmpeg binary:", ffmpegBin);

    // ===== 1) write uploaded File to a temp path =====
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `trim-input-${Date.now()}.mp4`);
    const outputPath = path.join(tmpDir, `trim-output-${Date.now()}.mp4`);

    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    await fs.writeFile(inputPath, fileBuffer);

    // ===== 2) run ffmpeg to trim =====
    const args = [
      "-hide_banner",
      "-y",                          // overwrite output if exists
      "-ss", startSec.toString(),    // start time
      "-to", endSec.toString(),      // end time
      "-i", inputPath,
      "-c", "copy",                  // stream copy (no re-encode, fast & small)
      "-movflags", "faststart",
      outputPath,
    ];

    console.log("Running ffmpeg with args:", args.join(" "));

    await runFfmpeg(ffmpegBin, args);

    // ===== 3) read trimmed file =====
    const trimmedBuffer = await fs.readFile(outputPath);
    const sizeMb = trimmedBuffer.length / (1024 * 1024);
    console.log(`Trimmed video size: ${sizeMb.toFixed(2)} MB`);

    // optional: sanity check
    if (trimmedBuffer.length === 0) {
      throw new Error("ffmpeg produced an empty output file");
    }

    // ===== 4) cleanup temp files (best-effort) =====
    safeUnlink(inputPath);
    safeUnlink(outputPath);

    // ===== 5) return binary video response =====
    // Client can call res.blob() and wrap into a File.
    return new NextResponse(trimmedBuffer, {
      status: 200,
      headers: {
        "Content-Type": file.type || "video/mp4",
        "Content-Length": String(trimmedBuffer.length),
        // you can also return a hint of trimmed duration via header if you want
        "X-Trim-Start": String(startSec),
        "X-Trim-End": String(endSec),
      },
    });
  } catch (err: any) {
    console.error("trim-video error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Spawn ffmpeg and wait until it finishes.
 */
function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);

    child.stdout.on("data", (data) => {
      console.log("[ffmpeg stdout]", data.toString());
    });

    child.stderr.on("data", (data) => {
      console.log("[ffmpeg stderr]", data.toString());
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

function safeUnlink(p: string) {
  fs.unlink(p).catch(() => {
    // ignore cleanup errors
  });
}
