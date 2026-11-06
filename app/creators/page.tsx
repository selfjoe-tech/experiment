import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import { absolute, BRAND } from "@/lib/seo/public";

export const revalidate=300;
export async function generateMetadata({searchParams}:{searchParams:Promise<{page?:string}>}):Promise<Metadata>{
 const raw=(await searchParams).page;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 return {
  title: page>1 ? "Discover creators — Page "+page : "Discover creators",
  description:"Browse active public creators sharing videos and images on Goon Gram.",
  alternates:{canonical:"https://goongram.com/creators"+(page>1?"?page="+page:"")},
  robots:{index:true,follow:true},
 };
}
type Props={searchParams:Promise<{page?:string}>};
export default async function CreatorsDirectory({searchParams}:Props){
 const {page:raw}=await searchParams;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 const limit=36;
 const db=await createClient();
 const {data, error}=await db.from("public_seo_profiles")
  .select("id,username,avatar_url,bio,follower_count,created_at")
  .order("created_at",{ascending:false})
  .range((page-1)*limit,page*limit-1);
 if(error)throw new Error("Creator directory unavailable");
 // Eligibility (real biography or public posts) is already enforced by the view.
 const profiles=data??[];
 const visible=profiles.filter(p=>Boolean(p.username));
 return <div className="min-h-screen bg-[#0b0d10] text-white">
  <DesktopShell/><MobileChrome/>
  <main className="mx-auto max-w-[1140px] px-4 pb-28 pt-[86px] sm:px-8 lg:pl-[100px] lg:pt-14">
   <header className="mb-9">
    <h1 className="text-2xl font-semibold tracking-tight">Discover creators</h1>
    <p className="mt-2 text-sm text-white/55">Explore public accounts posting videos and images.</p>
   </header>
   {visible.length? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {visible.map(p=><a key={p.id} href={`/${encodeURIComponent(p.username)}`}
      className="min-w-0 rounded-lg border border-white/10 px-3 py-5 text-center transition hover:border-white/30 hover:bg-white/[.03]">
      <img src={p.avatar_url||"/avatar-placeholder.png"} alt="" loading="lazy"
        className="mx-auto h-16 w-16 rounded-full bg-white/10 object-cover"/>
      <h2 className="mt-3 truncate text-sm font-semibold">@{p.username}</h2>
      {p.bio&&<p className="mt-1 line-clamp-2 text-xs leading-5 text-white/50">{p.bio}</p>}
     </a>)}
   </div> : <p className="py-20 text-center text-sm text-white/45">No active creators on this page yet.</p>}
   <nav aria-label="Creator directory pages" className="mt-10 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
    {page>1?<a href={page===2?"/creators":`/creators?page=${page-1}`}
      className="text-white/80 hover:underline">Previous</a>:<span/>}
    {profiles.length===limit&&<a href={`/creators?page=${page+1}`} className="text-white/80 hover:underline">Next page</a>}
   </nav>
  </main>
 </div>;
}
