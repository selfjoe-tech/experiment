import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WatchClient from "./watch-client";
import {
  SEO_BRAND, absoluteSeoUrl, getPublicMediaSeo, mediaSeoTitle,
  mediaSeoDescription, publicStorageUrl, seoIsoDuration, safeJsonLd,
} from "@/lib/server/publicSeo";

type Params={
  params:Promise<{id:string}>;
  searchParams:Promise<{s?:string|string[]}>;
};
async function videoForId(raw:string){
  if(!/^[1-9]\d*$/.test(raw))return null;
  const id=Number(raw);
  if(!Number.isSafeInteger(id))return null;
  const media=await getPublicMediaSeo(id);
  return media?.media_type==="video"?media:null;
}
export async function generateMetadata({params}:Pick<Params,"params">):Promise<Metadata>{
  const video=await videoForId((await params).id);
  if(!video)return {title:"Video unavailable",robots:{index:false,follow:false}};
  const canonical=absoluteSeoUrl(`/watch/${video.id}`);
  const title=mediaSeoTitle(video);
  const description=mediaSeoDescription(video);
  const thumb=publicStorageUrl(video.thumbnail_path);
  const contentUrl=publicStorageUrl(video.storage_path);
  const oembedUrl=absoluteSeoUrl(`/api/oembed?format=json&url=${encodeURIComponent(canonical)}`);
  return {
    title,description,
    alternates:{canonical,types:{"application/json+oembed":oembedUrl}},
    robots:{index:true,follow:true,googleBot:{"max-video-preview":-1,"max-image-preview":"large"}},
    openGraph:{
      type:"video.other",siteName:SEO_BRAND,url:canonical,title,description,
      images:thumb?[{url:thumb,width:video.width||undefined,height:video.height||undefined,alt:title}]:[],
      videos:contentUrl?[{url:contentUrl,secureUrl:contentUrl,type:"video/mp4"}]:[],
    },
    twitter:{card:thumb?"summary_large_image":"summary",title,description,
      images:thumb?[thumb]:[]},
  };
}
export default async function WatchPage({params,searchParams}:Params){
  const raw=(await params).id;
  const video=await videoForId(raw);
  if(!video)notFound();
  const query=await searchParams;
  const start=Array.isArray(query.s)?query.s[0]:query.s;
  const n=start&&/^\d+(?:\.\d+)?$/.test(start)?Number(start):0;
  const startAtSeconds=Number.isFinite(n)&&n>=0&&n<=86400?n:0;
  const canonical=absoluteSeoUrl(`/watch/${video.id}`);
  const creatorUrl=absoluteSeoUrl(`/${encodeURIComponent(video.username)}`);
  const contentUrl=publicStorageUrl(video.storage_path);
  const thumbnail=publicStorageUrl(video.thumbnail_path);
  const title=mediaSeoTitle(video);
  const isoDuration=seoIsoDuration(video.duration_seconds==null?null:Number(video.duration_seconds));
  const json={
    "@context":"https://schema.org",
    "@type":"VideoObject",
    "@id":canonical+"#video",
    name:title,
    description:mediaSeoDescription(video),
    url:canonical,
    uploadDate:video.created_at,
    ...(thumbnail?{thumbnailUrl:[thumbnail]}:{}),
    ...(isoDuration?{duration:isoDuration}:{}),
    ...(contentUrl?{contentUrl}:{}),
    embedUrl:absoluteSeoUrl(`/embed/${video.id}`),
    creator:{"@type":"Person",name:video.username,url:creatorUrl},
    ...(typeof video.view_count==="number"&&video.view_count>=0?
      {interactionStatistic:{"@type":"InteractionCounter",
        interactionType:{"@type":"WatchAction"},userInteractionCount:video.view_count}}:{}),
  };
  return <>
    <WatchClient mediaId={video.id} startAtSeconds={startAtSeconds}/>
    <section aria-label="Video information" className="mx-auto max-w-[960px] px-4 pb-14 pt-4 text-white lg:pl-[86px]">
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="mt-2 max-w-[700px] text-sm leading-6 text-white/65">{mediaSeoDescription(video)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/55">
        <a href={`/${encodeURIComponent(video.username)}`} className="font-semibold text-white/80 hover:underline">
          @{video.username}
        </a>
        <time dateTime={video.created_at}>{new Date(video.created_at).toLocaleDateString("en-GB")}</time>
        {isoDuration&&<span>Original length: {Math.ceil(Number(video.duration_seconds))} seconds</span>}
      </div>
      <nav className="mt-4 flex flex-wrap gap-3 text-xs text-white/55" aria-label="Video topics">
        {(video.tags||[]).map((tag,i)=><a key={i} className="hover:text-white"
          href={`/explore/niches/${encodeURIComponent(tag.toLowerCase().trim().replace(/\s+/g,"-"))}`}>#{tag}</a>)}
      </nav>
    </section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(json)}}/>
  </>;
}
