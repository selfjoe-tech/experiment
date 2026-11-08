import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WatchClient from "./watch-client";
import WatchBottomAds from "@/app/components/ads/WatchBottomAds";
import { getPublicMedia, publicMediaUrl, publicHttps, mediaTitle, absolute, isoDuration, safeJsonLd, BRAND, DEFAULT_IMAGE } from "@/lib/seo/public";

type Props={params:Promise<{id:string}>;searchParams:Promise<{s?:string|string[]}>};
const parsed=(id:string)=>/^[1-9][0-9]*$/.test(id)&&Number.isSafeInteger(Number(id))?Number(id):null;
const titleFor=(m:NonNullable<Awaited<ReturnType<typeof getPublicMedia>>>)=>mediaTitle(m.title,m.description,"video",m.id);
const excerpt=(m:NonNullable<Awaited<ReturnType<typeof getPublicMedia>>>)=>m.description?.trim()||m.title?.trim()||`Video ${m.id} on ${BRAND}`;
export const revalidate=300;

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const id=parsed((await params).id);
 const media=id?await getPublicMedia(id,"video"):null;
 if(!media)return {title:"Video unavailable",robots:{index:false,follow:false}};
 const canonical=absolute(`/watch/${media.id}`);
 const name=titleFor(media),description=excerpt(media);
 const thumbnail=publicHttps(publicMediaUrl(media.thumbnail_path));
 const src=publicHttps(publicMediaUrl(media.storage_path));
 return {
  title:name,description,
  alternates:{canonical,types:{"application/json+oembed":absolute(`/api/oembed?format=json&url=${encodeURIComponent(canonical)}`)}},
  robots:{index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large","max-video-preview":-1}},
  openGraph:{type:"video.other",url:canonical,title:name,description,images:[thumbnail||DEFAULT_IMAGE],
   ...(src?{videos:[{url:src}]}:{})},
  twitter:{card:"summary_large_image",title:name,description,images:[thumbnail||DEFAULT_IMAGE]},
 };
}

export default async function WatchPage({params,searchParams}:Props){
 const id=parsed((await params).id);
 if(!id)notFound();
 const video=await getPublicMedia(id,"video");
 if(!video)notFound();
 const canonical=absolute(`/watch/${id}`);
 const url=publicHttps(publicMediaUrl(video.storage_path));
 const thumb=publicHttps(publicMediaUrl(video.thumbnail_path));
 const duration=isoDuration(video.duration_seconds);
 const name=titleFor(video),description=excerpt(video);
 const creator=video.owner?.username;
 const structured=thumb&&url?{
  "@context":"https://schema.org","@type":"VideoObject",
  "@id":canonical+"#video",url:canonical,name,description,thumbnailUrl:[thumb],
  uploadDate:video.created_at,
  ...(duration?{duration}:{}),
  contentUrl:url,embedUrl:absolute(`/embed/${id}`),
  ...(creator?{creator:{"@type":"Person",name:creator,url:absolute(`/${encodeURIComponent(creator)}`)}}:{}),
  ...(Number.isFinite(Number(video.view_count))?{interactionStatistic:{
   "@type":"InteractionCounter",interactionType:{"@type":"WatchAction"},
   userInteractionCount:Number(video.view_count),
  }}:{}),
 }:null;
 const query=await searchParams;
 const raw=Array.isArray(query.s)?query.s[0]:query.s;
 const seconds=raw&&/^[0-9]+(?:[.][0-9]+)?$/.test(raw)?Number(raw):0;
 const startAtSeconds=Number.isFinite(seconds)&&seconds>=0&&seconds<=86400?seconds:0;
 return <div className="min-h-screen bg-[#0b0d10] text-white">
  {structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(structured)}}/>}
  <WatchClient mediaId={id} startAtSeconds={startAtSeconds}/>
  {/* <section className="mx-auto max-w-[1100px] px-4 pb-8 pt-6 text-white lg:pl-[92px]">
   <h1 className="text-lg font-semibold">{name}</h1>
   <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-white/65">{description}</p>
   <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/55">
    {creator&&<a href={`/${encodeURIComponent(creator)}`} className="font-medium text-white/80 hover:underline">By @{creator}</a>}
    <time dateTime={video.created_at}>Published {new Date(video.created_at).toLocaleDateString("en-US",{dateStyle:"medium"})}</time>
    {duration&&<span>Full video: {Math.ceil(Number(video.duration_seconds))} seconds</span>}
   </div>
   {(video.tags??[]).length>0&&<nav aria-label="Video topics" className="mt-4 flex flex-wrap gap-2">
    {(video.tags??[]).slice(0,10).map(tag=><a key={tag} href={`/explore/niches/${encodeURIComponent(tag.toLowerCase().replace(/\s+/g,"-"))}`}
      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60 hover:text-white">#{tag}</a>)}
   </nav>}
  </section> */}
  <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-2 lg:pl-[92px] lg:pb-12">
   <WatchBottomAds />
  </div>
 </div>;
}
