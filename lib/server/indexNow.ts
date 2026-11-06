import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SEO_SITE } from "@/lib/server/publicSeo";

export function indexNowKey(){
  const key=process.env.INDEXNOW_KEY||"";
  return /^[a-zA-Z0-9-]{8,128}$/.test(key)?key:null;
}
export async function deliverIndexNowBatch(ids?:number[]) {
  const key=indexNowKey();
  if(!key)return {sent:0,skipped:"INDEXNOW_KEY is not configured"};
  const admin=getSupabaseAdmin();
  let query=admin.from("seo_discovery_events")
    .select("id,canonical_url,attempts,status")
    .in("status",["queued","failed"]).lt("attempts",5)
    .order("created_at",{ascending:true}).limit(30);
  if(ids?.length)query=query.in("id",ids);
  const {data,error}=await query;
  if(error)throw error;
  const rows=(data||[]).filter(row=>{
    try{return new URL(row.canonical_url).origin===SEO_SITE;}catch{return false;}
  });
  if(!rows.length)return {sent:0};
  const urls=rows.map(row=>row.canonical_url);
  let failure:string|null=null;
  try {
    const response=await fetch("https://api.indexnow.org/indexnow",{
      method:"POST",
      headers:{"Content-Type":"application/json; charset=utf-8"},
      body:JSON.stringify({
        host:"goongram.com",
        key,
        keyLocation:SEO_SITE+"/indexnow-key.txt",
        urlList:urls,
      }),
      cache:"no-store",
      signal:AbortSignal.timeout(8000),
    });
    if(response.status!==200&&response.status!==202)
      failure=`IndexNow HTTP ${response.status}`;
  } catch(e){
    failure=e instanceof Error?e.message:"IndexNow transport error";
  }
  const now=new Date().toISOString();
  for(const row of rows){
    const {error:writeError}=await admin.from("seo_discovery_events").update({
      status:failure?"failed":"sent",
      attempts:Number(row.attempts||0)+1,
      updated_at:now,last_attempt_at:now,
      last_error:failure?.slice(0,300)||null,
    }).eq("id",row.id);
    if(writeError)console.error("SEO event update failed",writeError);
  }
  if(failure)throw new Error(failure);
  return {sent:rows.length};
}
