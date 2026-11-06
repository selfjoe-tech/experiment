import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import ProfileMediaPage from "./ProfileMediaPage";
import { createClient } from "@/lib/supabase/server";
import { absolute, encodeUsername, getPublicProfile, getPublicCreatorMedia, seoEligibleProfile, publicHttps, publicMediaUrl, safeJsonLd, BRAND, DEFAULT_IMAGE } from "@/lib/seo/public";

export const revalidate = 300;
type Props = { params: Promise<{username:string}> };
const RESERVED = new Set(["sitemap.xml","robots.txt","favicon.ico","api","auth","admin","upload","verify","saved","liked","earn","download","creators","image","watch","reels","explore","monetization","preferences","settings","ads"]);
const valid = (s:string) => /^[a-zA-Z0-9._]{1,40}$/.test(s) && !RESERVED.has(s.toLowerCase());

async function movedProfile(username:string):Promise<string|null>{
 const db=await createClient();
 const {data}=await db.from("profile_username_redirects").select("profile_id").ilike("old_username",username).maybeSingle();
 if(!data?.profile_id)return null;
 const {data:current}=await db.from("profiles").select("username").eq("id",data.profile_id).maybeSingle();
 return current?.username || null;
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {username}=await params;
 if(!valid(username))return {robots:{index:false,follow:false}};
 const profile=await getPublicProfile(username);
 if(!profile)return {title:"Profile unavailable",robots:{index:false,follow:false}};
 const posts=await getPublicCreatorMedia(profile.id,12);
 const eligible=seoEligibleProfile(profile,posts);
 const path=encodeUsername(profile.username);
 const title=`@${profile.username} — Creator profile`;
 const description=profile.bio?.trim()||`Explore public videos and images posted by @${profile.username} on ${BRAND}.`;
 const avatar=publicHttps(profile.avatar_url)||DEFAULT_IMAGE;
 return {
  title,description,alternates:{canonical:absolute(path)},
  robots:{index:eligible,follow:true,googleBot:{index:eligible,follow:true,"max-image-preview":"large","max-video-preview":-1}},
  openGraph:{type:"profile",url:absolute(path),title,description,images:[{url:avatar,alt:`@${profile.username}`}]},
  twitter:{card:"summary_large_image",title,description,images:[avatar]},
 };
}

export default async function ProfilePage({params}:Props){
 const {username}=await params;
 if(!valid(username))notFound();
 const profile=await getPublicProfile(username);
 if(!profile){
  const renamed=await movedProfile(username);
  if(renamed&&renamed.toLowerCase()!==username.toLowerCase())permanentRedirect(encodeUsername(renamed));
  notFound();
 }
 const posts=await getPublicCreatorMedia(profile.id,16);
 const page=absolute(encodeUsername(profile.username));
 const description=profile.bio?.trim();
 const image=publicHttps(profile.avatar_url);
 const schema={
  "@context":"https://schema.org","@type":"ProfilePage","@id":page+"#profile",
  url:page,name:`@${profile.username} on ${BRAND}`,
  ...(description?{description}:{}),
  dateCreated:profile.created_at,
  mainEntity:{"@type":"Person","@id":page+"#creator",name:profile.username,
    alternateName:"@"+profile.username,identifier:profile.id,url:page,
    ...(image?{image}:{})},
 };
 return <>
   <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>
   <Suspense fallback={<div className="mx-auto min-h-96 max-w-4xl animate-pulse rounded bg-white/[.02]"/>}>
    <ProfileMediaPage/>
   </Suspense>
   {posts.length>0&&<section aria-label="Recent public posts" className="mx-auto max-w-[980px] px-4 pb-28 pt-8 text-white lg:pl-[94px]">
    <h2 className="mb-4 text-base font-semibold">Recent posts by @{profile.username}</h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
     {posts.map(post=>{
      const path=post.media_type==="video"?`/watch/${post.id}`:`/image/${post.id}`;
      const thumb=publicHttps(publicMediaUrl(post.media_type==="video"?post.thumbnail_path:post.storage_path));
      return <a key={post.id} href={path} className="min-w-0 rounded-lg border border-white/10 p-2 text-xs transition hover:border-white/30">
       {thumb?<img src={thumb} alt={post.title?.trim()||`Post by @${profile.username}`} loading="lazy" className="mb-2 aspect-square w-full rounded object-cover"/>:
        <span className="mb-2 flex aspect-square items-center justify-center rounded bg-white/[.05] text-white/50">Video</span>}
       <span className="block truncate text-white/75">{post.title?.trim()||post.description?.trim().slice(0,55)||`${post.media_type==="video"?"Video":"Image"} ${post.id}`}</span>
      </a>;
     })}
    </div>
   </section>}
 </>;
}
