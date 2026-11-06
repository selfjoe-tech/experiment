import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import { getPublicMedia, mediaTitle, absolute, publicHttps, publicMediaUrl, safeJsonLd, BRAND, DEFAULT_IMAGE } from "@/lib/seo/public";

export const revalidate=300;
type Props={params:Promise<{id:string}>};
const parseId=(s:string)=>/^[1-9][0-9]*$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const id=parseId((await params).id);
 const item=id?await getPublicMedia(id,"image"):null;
 if(!item)return {title:"Image unavailable",robots:{index:false,follow:false}};
 const title=mediaTitle(item.title,item.description,"image",item.id);
 const description=item.description?.trim()||`Image by @${item.owner?.username||"a creator"} on ${BRAND}.`;
 const canonical=absolute(`/image/${id}`);
 const image=publicHttps(publicMediaUrl(item.storage_path));
 return {title,description,alternates:{canonical},robots:{index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large"}},
  openGraph:{type:"article",url:canonical,title,description,images:[image||DEFAULT_IMAGE]},
  twitter:{card:"summary_large_image",title,description,images:[image||DEFAULT_IMAGE]}};
}

export default async function PublicImagePage({params}:Props){
 const id=parseId((await params).id);
 if(!id)notFound();
 const item=await getPublicMedia(id,"image");
 const src=item?publicHttps(publicMediaUrl(item.storage_path)):null;
 if(!item||!src)notFound();
 const name=mediaTitle(item.title,item.description,"image",id);
 const canonical=absolute(`/image/${id}`);
 const creator=item.owner?.username;
 const schema={
  "@context":"https://schema.org","@type":"ImageObject",name,
  contentUrl:src,url:canonical,uploadDate:item.created_at,
  ...(item.description?.trim()?{description:item.description.trim()}:{}),
  ...(item.width&&item.height?{width:item.width,height:item.height}:{}),
  ...(creator?{creator:{"@type":"Person",name:creator,url:absolute(`/${encodeURIComponent(creator)}`)}}:{}),
 };
 return <div className="min-h-screen bg-[#0b0d10] text-white">
  <DesktopShell/><MobileChrome/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>
  <main className="mx-auto w-full max-w-[1150px] px-4 pb-28 pt-[85px] sm:px-7 lg:pl-[96px] lg:pt-12">
   <article className="mx-auto max-w-[760px]">
    <header className="mb-5">
     {creator&&<a href={`/${encodeURIComponent(creator)}`} className="text-sm font-semibold text-white/75 hover:underline">@{creator}</a>}
     <h1 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h1>
     <time dateTime={item.created_at} className="mt-2 block text-xs text-white/50">
      Published {new Date(item.created_at).toLocaleDateString("en-US",{dateStyle:"medium"})}
     </time>
    </header>
    <figure className="overflow-hidden rounded-lg bg-black">
     <img src={src} alt={name} width={item.width||undefined} height={item.height||undefined}
       className="mx-auto block h-auto max-h-[80dvh] w-full object-contain"/>
     {item.description&&<figcaption className="px-2 py-4 text-sm leading-6 text-white/65">{item.description}</figcaption>}
    </figure>
    {(item.tags??[]).length>0&&<nav aria-label="Related topics" className="mt-5 flex flex-wrap gap-2">
      {(item.tags??[]).slice(0,10).map(tag=><a key={tag}
       href={`/explore/niches/${encodeURIComponent(tag.toLowerCase().replace(/\s+/g,"-"))}`}
       className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/65">#{tag}</a>)}
     </nav>}
    <div className="mt-7 flex gap-4 text-sm">
     {creator&&<a href={`/${encodeURIComponent(creator)}`} className="text-white/80 underline underline-offset-4">More from @{creator}</a>}
     <a href="/explore/images" className="text-white/60 underline underline-offset-4">Explore images</a>
    </div>
   </article>
  </main>
 </div>;
}
