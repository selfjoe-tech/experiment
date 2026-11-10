import { sitemapChunk, SITEMAP_KINDS, urlset, xmlResponse, xmlError } from "@/lib/seo/sitemaps";
import { SITE } from "@/lib/seo/public";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(id==="static.xml")return xmlResponse(urlset([
  {loc:SITE+"/"},
  {loc:SITE+"/creators"},
  {loc:SITE+"/reels"},
  {loc:SITE+"/ads"},
  {loc:SITE+"/videos"},
  {loc:SITE+"/images"},
  {loc:SITE+"/explore/gifs"},
  {loc:SITE+"/explore/images"},
  {loc:SITE+"/explore/creators"},
  {loc:SITE+"/explore/niches"},
  {loc:SITE+"/monetization"},
  {loc:SITE+"/download"},
 ]));
 const match=/^(profiles|videos|images|niches)-(0|[1-9][0-9]*)\.xml$/.exec(id);
 if(!match || !SITEMAP_KINDS.includes(match[1] as typeof SITEMAP_KINDS[number]))return new Response("Not found",{status:404});
 const page=Number(match[2]);
 if(!Number.isSafeInteger(page)||page>100000)return new Response("Not found",{status:404});
 try{
  return xmlResponse(await sitemapChunk(match[1] as typeof SITEMAP_KINDS[number],page));
 }catch(error){console.error("SEO sitemap chunk failed",match[1],page,error);return xmlError();}
}
