// lib/python/watermark.ts
import { spawn } from "child_process";
import path from "path";

type WatermarkOptions = {
  inputPath: string;
  outputPath: string;
  text: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
};

export function runPythonWatermark({
  inputPath,
  outputPath,
  text,
  position,
}: WatermarkOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "watermark.py");

    const args = [scriptPath, inputPath, outputPath, text, position];

    const child = spawn("python", args);

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Python watermark script failed (code ${code}): ${stderr}`)
        );
      }
      resolve();
    });
  });
}
