import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE, publicMediaUrl, publicHttps, mediaTitle } from "./public";

export const CHUNK_SIZE = 500;
export type SitemapKind = "profiles" | "videos" | "images" | "niches";
export const SITEMAP_KINDS: SitemapKind[] = ["profiles","videos","images","niches"];
export function escapeXml(value: string): string {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
export function xmlResponse(body: string): Response {
  return new Response(body, { headers: {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    "X-Content-Type-Options": "nosniff",
  }});
}
export function xmlError(): Response {
  return new Response("Sitemap temporarily unavailable", {
    status: 503, headers: { "Cache-Control": "no-store" },
  });
}
export async function sitemapCounts() {
  const db = getSupabaseAdmin();
  const [profiles,videos,images,niches] = await Promise.all([
    db.from("public_seo_profiles").select("id",{head:true,count:"exact"}),
    db.from("public_seo_media").select("id",{head:true,count:"exact"}).eq("media_type","video"),
    db.from("public_seo_media").select("id",{head:true,count:"exact"}).eq("media_type","image"),
    db.from("public_seo_tags").select("id",{head:true,count:"exact"}),
  ]);
  for(const result of [profiles,videos,images,niches]) if(result.error) throw result.error;
  return {profiles:profiles.count??0,videos:videos.count??0,images:images.count??0,niches:niches.count??0};
}
type Entry = { loc:string;lastmod?:string|null;image?:string|null;video?:{
  thumbnail:string;title:string;description:string;content?:string;duration?:number;
}};
export function urlset(entries: Entry[]): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'+
    entries.map(e=>'<url><loc>'+escapeXml(e.loc)+'</loc>'+
      (e.lastmod?'<lastmod>'+escapeXml(e.lastmod)+'</lastmod>':'')+
      (e.image?'<image:image><image:loc>'+escapeXml(e.image)+'</image:loc></image:image>':'')+
      (e.video?'<video:video><video:thumbnail_loc>'+escapeXml(e.video.thumbnail)+'</video:thumbnail_loc>'+
        '<video:title>'+escapeXml(e.video.title)+'</video:title><video:description>'+escapeXml(e.video.description)+'</video:description>'+
        (e.video.content?'<video:content_loc>'+escapeXml(e.video.content)+'</video:content_loc>':'')+
        (e.video.duration?'<video:duration>'+Math.ceil(e.video.duration)+'</video:duration>':'')+
        '<video:family_friendly>no</video:family_friendly></video:video>':'')+
      '</url>').join('\n')+'\n</urlset>';
}
export async function sitemapChunk(kind:SitemapKind,page:number):Promise<string> {
  if(!Number.isInteger(page)||page<0)throw new Error("Invalid sitemap chunk");
  const db = getSupabaseAdmin(),from=page*CHUNK_SIZE,to=from+CHUNK_SIZE-1;
  if(kind==="profiles"){
    const {data,error}=await db.from("public_seo_profiles").select("id,username,created_at,avatar_url")
      .order("id").range(from,to);
    if(error)throw error;
    return urlset((data??[]).filter(p=>p.username).map(p=>({
      loc:SITE+"/"+encodeURIComponent(p.username),lastmod:p.created_at,image:publicHttps(p.avatar_url),
    })));
  }
  if(kind==="niches"){
    const {data,error}=await db.from("public_seo_tags").select("slug,created_at")
      .order("id").range(from,to);
    if(error)throw error;
    return urlset((data??[]).map(t=>({
      loc:SITE+"/explore/niches/"+encodeURIComponent(t.slug),lastmod:t.created_at,
    })));
  }
  const {data,error}=await db.from("public_seo_media")
    .select("id,title,description,created_at,storage_path,thumbnail_path,duration_seconds")
    .eq("media_type",kind==="videos"?"video":"image")
    .order("id").range(from,to);
  if(error)throw error;
  return urlset((data??[]).map(m=>{
    const loc=SITE+(kind==="videos"?"/watch/":"/image/")+m.id;
    const img=publicHttps(publicMediaUrl(kind==="videos"?m.thumbnail_path:m.storage_path));
    const content=publicHttps(publicMediaUrl(m.storage_path));
    return {loc,lastmod:m.created_at,image:img,
      // A generic logo is NOT a real video thumbnail. Omit video extension
      // until a real, crawler-accessible thumbnail exists.
      video:kind==="videos" && img?{
        thumbnail:img,title:mediaTitle(m.title,m.description,"video",m.id),
        description:m.description?.trim()||m.title?.trim()||"Video on Goon Gram",
        content,duration:m.duration_seconds?Number(m.duration_seconds):undefined,
      }:undefined};
  }));
}
