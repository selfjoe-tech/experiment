import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ExploreNicheTagClient from "./ExploreNicheTagClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  absoluteSeoUrl, mediaSeoTitle, mediaSeoPath, publicStorageUrl, safeJsonLd,
  type PublicMediaSeo,
} from "@/lib/server/publicSeo";

type Params={params:Promise<{tab:string;tag:string}>};
const tabs=new Set(["niches","gifs","images"]);
async function resolveTopic({params}:Params) {
  const {tab,tag}=await params;
  if(!tabs.has(tab)||!/^[a-z0-9-]{2,90}$/.test(tag))return null;
  const client=getSupabaseAdmin();
  const {data,error}=await client.from("public_seo_tags")
    .select("slug,label").eq("slug",tag).maybeSingle();
  if(error)throw error;
  if(!data)return null;
  let query=client.from("public_seo_media")
    .select("id,media_type,title,description,tags,username,owner_id,storage_path,thumbnail_path,created_at,avatar_url,verified,duration_seconds,width,height,view_count")
    .contains("tags",[data.label]).order("created_at",{ascending:false}).limit(24);
  if(tab==="images")query=query.eq("media_type","image");
  if(tab==="gifs")query=query.eq("media_type","video");
  const result=await query;
  if(result.error)throw result.error;
  if(!result.data?.length)return null;
  return{label:data.label,tag,tab,posts:result.data as PublicMediaSeo[]};
}
export async function generateMetadata(props:Params):Promise<Metadata> {
  const topic=await resolveTopic(props);
  if(!topic)return{title:"Topic unavailable",robots:{index:false,follow:false}};
  const title=`${topic.label} · ${topic.tab==="images"?"Images":topic.tab==="gifs"?"Videos":"Videos and images"}`;
  const description=`Explore publicly shared ${topic.label} content from creators on Goon Gram.`;
  const canonical=absoluteSeoUrl(`/explore/${topic.tab}/${topic.tag}`);
  return{
    title,description,alternates:{canonical},
    robots:{index:true,follow:true},
    openGraph:{type:"website",url:canonical,title,description},
    twitter:{card:"summary",title,description},
  };
}
export default async function ExploreNicheTagPage(props:Params) {
  const topic=await resolveTopic(props);
  if(!topic) notFound();
  const canonical=topic?absoluteSeoUrl(`/explore/${topic.tab}/${topic.tag}`):null;
  const schema=topic?{
    "@context":"https://schema.org",
    "@type":"CollectionPage",
    name:topic.label,
    url:canonical,
    mainEntity:{"@type":"ItemList",itemListElement:topic.posts.map((post,i)=>({
      "@type":"ListItem",position:i+1,url:absoluteSeoUrl(mediaSeoPath(post))
    }))},
  }:null;
  return <>
    <ExploreNicheTagClient/>
    {topic&&<section aria-label={`Public posts in ${topic.label}`}
      className="mx-auto max-w-[980px] px-4 pb-24 text-white lg:pl-[90px]">
      <h2 className="text-base font-semibold">{topic.label} posts</h2>
      <p className="mt-1 text-xs text-white/50">Browse individual public posts in this topic.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {topic.posts.map(media=><a key={media.id} href={mediaSeoPath(media)}
          className="min-w-0 overflow-hidden rounded-md border border-white/10 p-2 text-xs hover:bg-white/[.04]">
          {media.media_type==="image"&&publicStorageUrl(media.storage_path)?
            <img src={publicStorageUrl(media.storage_path)!} alt={mediaSeoTitle(media)}
              className="mb-2 aspect-square w-full object-cover" loading="lazy"/>:
            <span className="mb-2 flex aspect-square items-center justify-center bg-white/[.045]">Video</span>}
          <span className="block truncate">{mediaSeoTitle(media)}</span>
          <span className="mt-1 block truncate text-white/45">@{media.username}</span>
        </a>)}
      </div>
    </section>}
    {schema&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>}
  </>;
}
