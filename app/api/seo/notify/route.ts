import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SEO_SITE, absoluteSeoUrl, getPublicMediaSeo, getPublicProfileSeo, mediaSeoPath } from "@/lib/server/publicSeo";
import { deliverIndexNowBatch } from "@/lib/server/indexNow";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  const origin=request.headers.get("origin");
  if(origin!==SEO_SITE&&origin!=="https://www.goongram.com" &&
    !(process.env.NODE_ENV!=="production" && origin?.startsWith("http://localhost:")))
    return Response.json({error:"Invalid request origin"},{status:403});
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return Response.json({error:"Login required"},{status:401});
  let input:{kind?:string;id?:number|string};
  try {input=await request.json();}catch {
    return Response.json({error:"Invalid JSON"},{status:400});
  }
  let url:string|undefined;
  let kind:"profile"|"video"|"image"|undefined;
  if(input.kind==="profile"){
    const profile=await getPublicProfileSeo(String(input.id||""));
    if(profile?.id===user.id){
      url=absoluteSeoUrl("/"+encodeURIComponent(profile.username));kind="profile";
    }
  }else if(input.kind==="media"){
    const id=Number(input.id);
    const media=await getPublicMediaSeo(id);
    if(media?.owner_id===user.id){
      url=absoluteSeoUrl(mediaSeoPath(media));kind=media.media_type;
    }
  }
  if(!url||!kind)return Response.json({eligible:false},{status:200});
  const admin=getSupabaseAdmin();
  const {data,error}=await admin.from("seo_discovery_events").upsert({
    canonical_url:url,kind,status:"queued",
    updated_at:new Date().toISOString(),last_error:null,attempts:0,
  },{onConflict:"canonical_url"}).select("id").single();
  if(error) {
    console.error("SEO queue failed",error);
    return Response.json({queued:false},{status:503});
  }
  // Retry queue persists if the publisher notification fails.
  after(async()=>{try{await deliverIndexNowBatch([data.id]);}
    catch(e){console.error("IndexNow delivery failed",e);}});
  return Response.json({queued:true,canonical:url},{status:202});
}
