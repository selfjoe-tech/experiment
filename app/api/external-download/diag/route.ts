import { PornHub } from "pornhub.js";
import ffmpegPath from "ffmpeg-static";
import { existsSync } from "node:fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return new Response(null,{status:404});
  const video = await new PornHub().video("https://www.pornhub.com/view_video.php?viewkey=ph5ac81eabe203d");
  const definitions = Array.isArray(video.mediaDefinitions) ? video.mediaDefinitions : [];
  const examples=[];
  for (const d of definitions.slice(0,4)) {
    const u= typeof d.videoUrl==="string"? d.videoUrl:"";
    if(!u)continue;
    try {
      const r=await fetch(u,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",Referer:"https://www.pornhub.com/"},cache:"no-store",signal:AbortSignal.timeout(12000)});
      const t=(await r.text()).slice(0,2000);
      examples.push({format:d.format, quality:d.quality,host:new URL(u).hostname,status:r.status,ct:r.headers.get("content-type"),size:t.length,lineTypes:t.split("\n").slice(0,18).map(x=>x.startsWith("#")?x:/"?https?:\/\//.test(x)?"[absolute-url]":x.length>140?"[long-segment-path]":x)});
    }catch(e){examples.push({format:d.format,quality:d.quality,error:String(e).slice(0,150)})}
  }
  return Response.json({ffmpegPath:ffmpegPath ? {exists:existsSync(ffmpegPath),path:ffmpegPath.split("/").slice(-3).join("/")} : null, definitions:definitions.map(d=>({format:d.format,quality:d.quality,host:typeof d.videoUrl==="string"?new URL(d.videoUrl).hostname:null})),examples});
}
