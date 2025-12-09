// app/api/watermark/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runPythonWatermark } from "@/lib/python/watermark";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("video") as File | null;
    const text = (formData.get("text") as string | null) || "";
    const position =
      ((formData.get("position") as string | null) ||
        "bottom-right") as
        | "top-left"
        | "top-right"
        | "bottom-left"
        | "bottom-right"
        | "center";

    if (!file) {
      return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Watermark text is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `wm-input-${Date.now()}.mp4`);
    const outputPath = path.join(tmpDir, `wm-output-${Date.now()}.mp4`);

    fs.writeFileSync(inputPath, buffer);

    await runPythonWatermark({
      inputPath,
      outputPath,
      text,
      position,
    });

    const resultBuffer = fs.readFileSync(outputPath);

    // Optional: cleanup temp files
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});

    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="watermarked.mp4"',
      },
    });
  } catch (err: any) {
    console.error("Watermark API error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to process video" },
      { status: 500 }
    );
  }
}
