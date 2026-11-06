import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getFfmpegPath } from "@/lib/ffmpegServer";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const run=promisify(execFile);

/** Admin-only maintenance: processes exactly one old Supabase-hosted upload. */
export async function POST(){
  try{
    await requireAdmin();
    const admin=getSupabaseAdmin();
    const {data:media,error}=await admin.from("media")
      .select("id,owner_id,storage_path")
      .eq("media_type","video")
      .is("thumbnail_path",null)
      .order("created_at",{ascending:true})
      .limit(20);
    if(error)throw error;
    if(!media?.length)return Response.json({done:true});
    const item=media.find(m=>m.storage_path&&!/^https?:\/\//i.test(m.storage_path));
    if(!item)return Response.json({done:true,warning:"Remaining videos need remote CDN poster processing."});
    const {data:blob,error:downloadError}=await admin.storage.from("media").download(item.storage_path);
    if(downloadError||!blob)throw downloadError||new Error("Video download failed");
    if(blob.size>60*1024*1024)throw new Error("Video too large for one-time poster processing");
    const directory=await mkdtemp(path.join(tmpdir(),"goongram-seo-"));
    try{
      const input=path.join(directory,"input.mp4");
      const output=path.join(directory,"poster.jpg");
      await writeFile(input,Buffer.from(await blob.arrayBuffer()));
      await run(getFfmpegPath(),[
        "-nostdin","-hide_banner","-loglevel","error",
        "-ss","1","-i",input,"-frames:v","1",
        "-vf","scale=960:960:force_original_aspect_ratio=decrease",
        "-q:v","3","-y",output
      ],{timeout:30000,maxBuffer:1024*1024});
      const buffer=await readFile(output);
      if(!buffer.length)throw new Error("Poster output was empty");
      const destination=`posters/${item.owner_id}/${randomUUID()}.jpg`;
      const {error:uploadError}=await admin.storage.from("media")
        .upload(destination,buffer,{contentType:"image/jpeg",upsert:false});
      if(uploadError)throw uploadError;
      const {error:updateError}=await admin.from("media").update({thumbnail_path:destination})
        .eq("id",item.id).is("thumbnail_path",null);
      if(updateError)throw updateError;
      return Response.json({ok:true,mediaId:item.id});
    } finally {
      await rm(directory,{recursive:true,force:true});
    }
  }catch(error){
    console.error("SEO poster backfill failed",error);
    return Response.json({error:"Poster processing failed; check server logs."},{status:500});
  }
}
