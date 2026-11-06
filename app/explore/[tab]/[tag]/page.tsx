import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ExploreNicheTagClient from "./ExploreNicheTagClient";
import { createClient } from "@/lib/supabase/server";
import { absolute, mediaTitle, publicMediaUrl, publicHttps, safeJsonLd } from "@/lib/seo/public";

type Props={params:Promise<{tab:string;tag:string}>};
type TagPost={id:number;media_type:string;title:string|null;description:string|null;storage_path:string|null;thumbnail_path:string|null};
const eligibleTabs=["niches","gifs","images"];
async function getTopic(tab:string,slug:string){
 if(!eligibleTabs.includes(tab)||!slug||slug.length>100||!/^[\w-]+$/.test(slug))return null;
 const db=await createClient();
 const {data:tag}=await db.from("tags").select("slug,label").eq("slug",slug).maybeSingle();
 if(!tag)return null;
 let q=db.from("media").select("id,media_type,title,description,storage_path,thumbnail_path")
  .not("storage_path","is",null)
  .overlaps("tags",[tag.slug,tag.label].filter(Boolean)).order("created_at",{ascending:false}).limit(16);
 if(tab==="gifs")q=q.eq("media_type","video");
 else if(tab==="images")q=q.eq("media_type","image");
 else q=q.in("media_type",["video","image"]);
 const {data}=await q;
 return {tag,posts:(data??[]) as TagPost[]};
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {tab,tag}=await params;
 const topic=await getTopic(tab,tag);
 if(!topic)return {title:"Topic unavailable",robots:{index:false,follow:false}};
 const canonical=absolute(`/explore/${tab}/${tag}`);
 const title=`${topic.tag.label} ${tab==="images"?"images":"videos"}`;
 const description=`Explore public ${topic.tag.label} ${tab==="images"?"images":"videos"} from Goon Gram creators.`;
 // Index only real, populated topics; do not turn arbitrary searches into doorway pages.
 const index=topic.posts.length>=2;
 return {title,description,alternates:{canonical},robots:{index,follow:true},
  openGraph:{type:"website",url:canonical,title,description},twitter:{card:"summary",title,description}};
}
export default async function ExploreNicheTagPage({params}:Props){
 const {tab,tag}=await params;
 const topic=await getTopic(tab,tag);
 if(!topic)notFound();
 const canonical=absolute(`/explore/${tab}/${tag}`);
 const schema=topic.posts.length>=2?{
  "@context":"https://schema.org","@type":"CollectionPage",name:topic.tag.label,
  url:canonical,mainEntity:{"@type":"ItemList",itemListElement:topic.posts.map((p,i)=>({
   "@type":"ListItem",position:i+1,url:absolute(p.media_type==="video"?`/watch/${p.id}`:`/image/${p.id}`),
  }))},
 }:null;
 return <>
  {schema&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>}
  <ExploreNicheTagClient/>
  {topic.posts.length>0&&<section className="mx-auto max-w-[1000px] px-4 pb-28 pt-8 text-white lg:pl-[100px]">
   <h2 className="mb-4 text-lg font-semibold">{topic.tag.label} posts</h2>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {topic.posts.map(p=>{
     const href=p.media_type==="video"?`/watch/${p.id}`:`/image/${p.id}`;
     const img=publicHttps(publicMediaUrl(p.media_type==="video"?p.thumbnail_path:p.storage_path));
     return <a key={p.id} href={href} className="min-w-0 rounded-lg border border-white/10 p-2 text-sm transition hover:border-white/30">
      {img?<img src={img} alt={mediaTitle(p.title,p.description,p.media_type,p.id)}
       loading="lazy" className="mb-2 aspect-square w-full rounded object-cover"/>:
       <div className="mb-2 flex aspect-square items-center justify-center rounded bg-white/[.06] text-xs">Video</div>}
      <span className="block truncate text-white/75">{mediaTitle(p.title,p.description,p.media_type,p.id)}</span>
     </a>;
    })}
   </div>
  </section>}
 </>;
}
