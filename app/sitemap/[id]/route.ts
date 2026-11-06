import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SEO_SITE, mediaSeoPath, publicStorageUrl, mediaSeoTitle } from "@/lib/server/publicSeo";
import type { PublicMediaSeo } from "@/lib/server/publicSeo";

export const runtime = "nodejs";
export const revalidate = 300;
const SIZE = 500;
type Kind = "profiles"|"videos"|"images"|"tags";
const escapeXml=(s:unknown)=>String(s??"").replace(/&/g,"&amp;")
  .replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
function validDate(date:string|null|undefined) {
  return date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null;
}
function response(body:string) {
  return new Response(body,{headers:{"Content-Type":"application/xml; charset=utf-8",
    "Cache-Control":"public, s-maxage=300, stale-while-revalidate=1800"}});
}
function urlEntry(loc:string,lastmod?:string|null,extra="") {
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod?`<lastmod>${escapeXml(lastmod)}</lastmod>`:""}${extra}</url>`;
}
function absolute(path:string) { return SEO_SITE+path; }
function staticSitemap(){
  const links=[
    "/", "/reels", "/explore/gifs", "/explore/images", "/explore/creators",
    "/explore/niches", "/creators", "/monetization", "/ads"
  ];
  return links.map(path=>urlEntry(absolute(path))).join("");
}
async function count(table:string,type?:string) {
  let q=getSupabaseAdmin().from(table).select("id",{count:"exact",head:true});
  if(type)q=q.eq("media_type",type);
  const {count,error}=await q;
  if(error)throw error;
  return count||0;
}
async function pageRows(table:string,columns:string,offset:number,type?:string){
  let q=getSupabaseAdmin().from(table).select(columns)
    .order("created_at",{ascending:false}).order("id",{ascending:false})
    .range(offset,offset+SIZE-1);
  if(type)q=q.eq("media_type",type);
  const {data,error}=await q;
  if(error)throw error;
  return data??[];
}
function urlXml(type:Kind,rows:Record<string,any>[]){
  if(type==="profiles")return rows.map(p=>urlEntry(
    absolute("/"+encodeURIComponent(p.username)),validDate(p.created_at)
  )).join("");
  if(type==="tags")return rows.map(t=>urlEntry(
    absolute("/explore/niches/"+encodeURIComponent(t.slug)),validDate(t.created_at)
  )).join("");
  return rows.map(row=>{
    const media=row as PublicMediaSeo;
    const loc=absolute(mediaSeoPath(media));
    const date=validDate(media.created_at);
    const source=publicStorageUrl(media.storage_path);
    const thumbnail=publicStorageUrl(media.thumbnail_path);
    if(media.media_type==="image"){
      return urlEntry(loc,date,source?
        `<image:image><image:loc>${escapeXml(source)}</image:loc></image:image>`:"");
    }
    // Google requires a REAL thumbnail URL. Do not substitute the site's logo.
    // A video without a processed poster remains a canonical <url> until a
    // video-specific thumbnail is published.
    if(!thumbnail)return urlEntry(loc,date);
    const duration=media.duration_seconds==null?null:Number(media.duration_seconds);
    const video=`<video:video><video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>`+
      `<video:title>${escapeXml(mediaSeoTitle(media))}</video:title>`+
      `<video:description>${escapeXml(media.description?.trim()||mediaSeoTitle(media))}</video:description>`+
      `<video:player_loc>${escapeXml(absolute("/embed/"+media.id))}</video:player_loc>`+
      (source?`<video:content_loc>${escapeXml(source)}</video:content_loc>`:"")+
      (duration&&duration>0?`<video:duration>${Math.ceil(duration)}</video:duration>`:"")+
      `<video:publication_date>${escapeXml(date||media.created_at)}</video:publication_date>`+
      `<video:family_friendly>no</video:family_friendly></video:video>`;
    return urlEntry(loc,date,video);
  }).join("");
}
export async function GET(request:Request) {
  const raw=new URL(request.url).pathname.split("/").at(-1)??"";
  const match=/^(0|[1-9]\d*)\.xml$/.exec(raw);
  if(!match)return new Response("Not found",{status:404});
  const id=Number(match[1]);
  if(!Number.isSafeInteger(id)||id>100000)return new Response("Not found",{status:404});
  try {
    let items:string;
    if(id===0)items=staticSitemap();
    else{
      const [profiles,videos,images,tags]=await Promise.all([
        count("public_seo_profiles"),count("public_seo_media","video"),
        count("public_seo_media","image"),count("public_seo_tags")
      ]);
      const sizes=[profiles,videos,images,tags].map(x=>Math.ceil(x/SIZE));
      const kinds:Kind[]=["profiles","videos","images","tags"];
      let pos=id-1,kind:Kind|null=null,offset=0;
      for(let i=0;i<kinds.length;i++){
        if(pos<sizes[i]){kind=kinds[i];offset=pos*SIZE;break;}
        pos-=sizes[i];
      }
      if(!kind)return new Response("Not found",{status:404});
      const rows=kind==="profiles"
        ?await pageRows("public_seo_profiles","id,username,created_at",offset)
        :kind==="tags"
        ?await pageRows("public_seo_tags","id,slug,label,created_at",offset)
        :await pageRows("public_seo_media",
          "id,media_type,title,description,storage_path,thumbnail_path,created_at,duration_seconds,tags,username",offset,
          kind==="videos"?"video":"image");
      if(!rows.length)return new Response("Not found",{status:404});
      items=urlXml(kind,rows as Record<string,any>[]);
    }
    return response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${items}</urlset>`);
  } catch(e){
    console.error("SEO sitemap chunk failed",e);
    return new Response("Sitemap temporarily unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
