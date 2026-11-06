import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import ProfileMediaPage from "./ProfileMediaPage";
import {
  SEO_BRAND, absoluteSeoUrl, getPublicProfileSeo, getProfilePublicMedia,
  mediaSeoPath, mediaSeoTitle, publicStorageUrl, safeJsonLd,
} from "@/lib/server/publicSeo";

export const revalidate=300;
type Params={params:Promise<{username:string}>};
async function resolveUsername(params:Params["params"]){
  const raw=(await params).username;
  try{return decodeURIComponent(raw).trim().toLowerCase();}catch{return "";}
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
  const username=await resolveUsername(params);
  const profile=await getPublicProfileSeo(username);
  if(!profile)return {title:"Creator unavailable",robots:{index:false,follow:false}};
  const url=absoluteSeoUrl(`/${encodeURIComponent(profile.username)}`);
  const title=`@${profile.username} · Creator profile`;
  const description=profile.bio?.trim().slice(0,240)||
    `See publicly shared videos and images from @${profile.username} on ${SEO_BRAND}.`;
  const image=profile.avatar_url?.startsWith("https://")?profile.avatar_url:null;
  return{
    title,description,
    alternates:{canonical:url},
    robots:{index:true,follow:true,googleBot:{"max-image-preview":"large"}},
    openGraph:{type:"profile",siteName:SEO_BRAND,url,title,description,
      images:image?[{url:image,alt:`@${profile.username} creator avatar`}]:[]},
    twitter:{card:image?"summary_large_image":"summary",title,description,
      images:image?[image]:[]},
  };
}
function ProfileFallback(){
  return <div className="mx-auto max-w-4xl px-4 py-8" aria-label="Loading creator profile">
    <div className="mb-9 h-24 animate-pulse rounded-lg bg-white/[.05]"/>
    <div className="grid grid-cols-3 gap-1">{Array.from({length:9},(_,i)=>
      <div key={i} className="aspect-square animate-pulse bg-white/[.04]"/>)}</div>
  </div>;
}
export default async function ProfilePage({params}:Params){
  const username=await resolveUsername(params);
  const profile=await getPublicProfileSeo(username);
  if(!profile) {
    const admin=getSupabaseAdmin();
    const {data:redirectRecord}=await admin.from("profile_username_redirects")
      .select("profile_id").eq("old_username",username).maybeSingle();
    if(redirectRecord?.profile_id) {
      const {data:destination}=await admin.from("public_seo_profiles")
        .select("username").eq("id",redirectRecord.profile_id).maybeSingle();
      if(destination?.username) permanentRedirect("/"+encodeURIComponent(destination.username));
    }
    notFound();
  }
  const recent=await getProfilePublicMedia(profile.id,24);
  const url=absoluteSeoUrl(`/${encodeURIComponent(profile.username)}`);
  const json={
    "@context":"https://schema.org",
    "@type":"ProfilePage",
    "@id":url+"#profile",
    url,
    dateCreated:profile.created_at,
    mainEntity:{
      "@type":"Person",
      "@id":url+"#creator",
      name:profile.username,
      alternateName:"@"+profile.username,
      identifier:profile.username,
      url,
      ...(profile.bio?.trim()?{description:profile.bio.trim()}:{}),
      ...(profile.avatar_url?.startsWith("https://")?{image:profile.avatar_url}:{}),
    },
    ...(recent.length?{hasPart:{"@type":"ItemList",itemListElement:recent.map((item,i)=>({
      "@type":"ListItem",position:i+1,url:absoluteSeoUrl(mediaSeoPath(item))
    }))}}:{}),
  };
  return <>
    <Suspense fallback={<ProfileFallback/>}><ProfileMediaPage/></Suspense>
    <section aria-label={`Public posts from ${profile.username}`}
      className="mx-auto max-w-[900px] px-4 pb-20 pt-7 text-white lg:ml-[76px]">
      <h2 className="text-sm font-semibold">Posts from @{profile.username}</h2>
      <p className="mt-1 text-xs text-white/55">Browse individual public videos and images.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {recent.map(item=><a key={item.id} href={mediaSeoPath(item)}
          className="min-w-0 rounded-md border border-white/10 p-2 text-xs hover:bg-white/[.04]">
          {item.media_type==="image"&&publicStorageUrl(item.storage_path)?
            <img src={publicStorageUrl(item.storage_path)!} alt={mediaSeoTitle(item)}
              className="mb-2 aspect-square w-full object-cover" loading="lazy"/>:
            <span className="mb-2 flex aspect-square items-center justify-center bg-white/[.035] text-white/40">
              Video
            </span>}
          <span className="block truncate">{mediaSeoTitle(item)}</span>
        </a>)}
      </div>
    </section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(json)}}/>
  </>;
}
