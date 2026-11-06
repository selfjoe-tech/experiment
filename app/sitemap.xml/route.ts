import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SEO_SITE } from "@/lib/server/publicSeo";

export const runtime = "nodejs";
export const revalidate = 300;
const CHUNK = 500;

async function count(table:string, mediaType?:string):Promise<number>{
  let q = getSupabaseAdmin().from(table).select("id",{head:true,count:"exact"});
  if(mediaType) q=q.eq("media_type",mediaType);
  const {count,error}=await q;
  if(error)throw error;
  return count??0;
}
export async function GET(){
  try{
    const [profiles,videos,images,tags]=await Promise.all([
      count("public_seo_profiles"),count("public_seo_media","video"),
      count("public_seo_media","image"),count("public_seo_tags")
    ]);
    const pages=[profiles,videos,images,tags].map(n=>Math.ceil(n/CHUNK));
    const total=pages.reduce((a,b)=>a+b,0);
    const items=[0,...Array.from({length:total},(_,i)=>i+1)]
      .map(n=>`<sitemap><loc>${SEO_SITE}/sitemap/${n}.xml</loc></sitemap>`).join("");
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
    return new Response(xml,{headers:{"Content-Type":"application/xml; charset=utf-8",
      "Cache-Control":"public, s-maxage=300, stale-while-revalidate=1800"}});
  } catch(e){
    console.error("SEO sitemap index failed",e);
    return new Response("Sitemap temporarily unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
