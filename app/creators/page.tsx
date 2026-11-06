import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import { SEO_BRAND, absoluteSeoUrl, safeJsonLd } from "@/lib/server/publicSeo";

type Args={searchParams:Promise<{page?:string}>};
const LIMIT=30;
function pageNumber(raw?:string){const n=Number(raw||"1");return Number.isSafeInteger(n)&&n>0&&n<=10000?n:1;}
export async function generateMetadata({searchParams}:Args):Promise<Metadata>{
  const page=pageNumber((await searchParams).page);
  const canonical=absoluteSeoUrl(page===1?"/creators":`/creators?page=${page}`);
  return{title:page===1?"Discover creators":`Creators · Page ${page}`,
    description:"Explore public Goon Gram creators and their videos and images.",
    alternates:{canonical},robots:{index:true,follow:true}};
}
export default async function CreatorsPage({searchParams}:Args){
  const page=pageNumber((await searchParams).page);
  const {data,error,count}=await getSupabaseAdmin().from("public_seo_profiles")
    .select("id,username,bio,avatar_url,created_at",{count:"exact"})
    .order("created_at",{ascending:false})
    .range((page-1)*LIMIT,page*LIMIT-1);
  if(error)throw error;
  const creators=data||[];
  const total=count||0;
  const schema={
    "@context":"https://schema.org",
    "@type":"CollectionPage",
    url:absoluteSeoUrl(page===1?"/creators":`/creators?page=${page}`),
    name:`Creators on ${SEO_BRAND}`,
    mainEntity:{"@type":"ItemList",itemListElement:creators.map((c,i)=>({
      "@type":"ListItem",position:(page-1)*LIMIT+i+1,
      name:c.username,url:absoluteSeoUrl("/"+encodeURIComponent(c.username))
    }))}
  };
  return <div className="min-h-screen bg-[#0b0d10] text-white">
    <DesktopShell/><MobileChrome/>
    <main className="mx-auto max-w-[1150px] px-4 pb-32 pt-[86px] lg:pl-[106px] lg:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Discover creators</h1>
      <p className="mt-2 text-sm text-white/55">Public creators sharing videos and images on Goon Gram.</p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {creators.map(c=><a href={`/${encodeURIComponent(c.username)}`} key={c.id}
          className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/[.04]">
          <img src={c.avatar_url||"/avatar-placeholder.png"} alt="" width={40} height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"/>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">@{c.username}</span>
            {c.bio&&<span className="mt-1 block truncate text-xs text-white/45">{c.bio}</span>}
          </span>
        </a>)}
      </div>
      {!creators.length&&<p className="py-14 text-sm text-white/50">No public creators on this page.</p>}
      <nav aria-label="Creator directory pagination" className="mt-8 flex gap-3 text-sm">
        {page>1&&<a href={page===2?"/creators":`/creators?page=${page-1}`}
          className="rounded-md border border-white/20 px-4 py-2">Previous</a>}
        {page*LIMIT<total&&<a href={`/creators?page=${page+1}`}
          className="rounded-md border border-white/20 px-4 py-2">Next</a>}
      </nav>
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>
  </div>;
}
