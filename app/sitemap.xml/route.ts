import { SITE } from "@/lib/seo/public";
import { sitemapCounts, SITEMAP_KINDS, CHUNK_SIZE, xmlResponse, xmlError, escapeXml } from "@/lib/seo/sitemaps";
export const runtime="nodejs";
export const revalidate=300;
export async function GET(){
 try{
  const counts=await sitemapCounts();
  const urls=[SITE+"/sitemap/static.xml"];
  for(const kind of SITEMAP_KINDS)
    for(let i=0;i<Math.ceil(counts[kind]/CHUNK_SIZE);i++)
      urls.push(`${SITE}/sitemap/${kind}-${i}.xml`);
  return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(url=>'<sitemap><loc>'+escapeXml(url)+'</loc></sitemap>').join('\n')+
    '\n</sitemapindex>');
 }catch(error){console.error("SEO sitemap index failed",error);return xmlError();}
}
