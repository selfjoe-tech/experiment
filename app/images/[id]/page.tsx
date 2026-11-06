import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import { getPublicMediaSeo, absoluteSeoUrl, mediaSeoTitle, mediaSeoDescription, publicStorageUrl, safeJsonLd } from "@/lib/server/publicSeo";

type Params={params:Promise<{id:string}>};
async function mediaForId(raw:string) {
  if(!/^[1-9]\d*$/.test(raw))return null;
  const id=Number(raw);
  if(!Number.isSafeInteger(id))return null;
  const media=await getPublicMediaSeo(id);
  return media?.media_type==="image"?media:null;
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
  const media=await mediaForId((await params).id);
  if(!media)return {title:"Image unavailable",robots:{index:false,follow:false}};
  const canonical=absoluteSeoUrl(`/images/${media.id}`);
  const image=publicStorageUrl(media.storage_path);
  const title=mediaSeoTitle(media);
  const description=mediaSeoDescription(media);
  return {
    title,
    description,
    alternates:{canonical},
    robots:{index:true,follow:true,googleBot:{"max-image-preview":"large"}},
    openGraph:{type:"article",url:canonical,title,description,
      images:image?[{url:image,width:media.width||undefined,height:media.height||undefined,alt:title}]:[]},
    twitter:{card:"summary_large_image",title,description,images:image?[image]:[]},
  };
}
export default async function PublicImagePage({params}:Params){
  const media=await mediaForId((await params).id);
  if(!media)notFound();
  const src=publicStorageUrl(media.storage_path);
  if(!src)notFound();
  const title=mediaSeoTitle(media);
  const canonical=absoluteSeoUrl(`/images/${media.id}`);
  const creatorUrl=absoluteSeoUrl(`/${encodeURIComponent(media.username)}`);
  const schema={
    "@context":"https://schema.org",
    "@type":"ImageObject",
    "@id":canonical+"#image",
    name:title,
    description:mediaSeoDescription(media),
    url:canonical,
    contentUrl:src,
    datePublished:media.created_at,
    creator:{"@type":"Person",name:media.username,url:creatorUrl},
    ...(media.width&&media.height?{width:media.width,height:media.height}:{}),
  };
  return <div className="min-h-screen bg-[#0b0d10] text-white">
    <DesktopShell/><MobileChrome/>
    <main className="mx-auto max-w-[1050px] px-4 pb-24 pt-[88px] lg:pl-[96px] lg:pt-10">
      <div className="mx-auto max-w-[720px]">
        <nav className="mb-5 text-xs text-white/50">
          <a href="/explore/images" className="hover:text-white">Images</a> / <a className="hover:text-white" href={`/${encodeURIComponent(media.username)}`}>@{media.username}</a>
        </nav>
        <h1 className="mb-4 break-words text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <a href={`/${encodeURIComponent(media.username)}`} className="mb-4 inline-flex text-sm font-medium hover:underline">@{media.username}</a>
        <figure>
          <img src={src} alt={title} width={media.width||undefined} height={media.height||undefined}
            className="mx-auto max-h-[80vh] w-auto max-w-full rounded-md object-contain" loading="eager"/>
          <figcaption className="mt-4 text-sm leading-6 text-white/65">{mediaSeoDescription(media)}</figcaption>
        </figure>
        <p className="mt-4 text-xs text-white/45">Uploaded <time dateTime={media.created_at}>{new Date(media.created_at).toLocaleDateString("en-GB")}</time></p>
        {(media.tags||[]).length>0&&<nav className="mt-5 flex flex-wrap gap-3 text-xs" aria-label="Related topics">
          {media.tags?.map((tag,i)=><a key={i} href={`/explore/niches/${encodeURIComponent(tag.trim().toLowerCase().replace(/\s+/g,"-"))}`}
            className="text-white/60 hover:text-white">#{tag}</a>)}
        </nav>}
      </div>
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>
  </div>;
}
