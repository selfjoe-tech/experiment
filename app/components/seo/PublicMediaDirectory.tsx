import { createClient } from "@/lib/supabase/server";
import { absolute, mediaTitle, publicMediaUrl, publicHttps } from "@/lib/seo/public";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";

type Kind = "video" | "image";
export default async function PublicMediaDirectory({
 kind, page,
}: { kind:Kind;page:number }) {
 const db=await createClient(),limit=36;
 const {data,error}=await db.from("public_seo_media")
   .select("id,media_type,created_at,storage_path,thumbnail_path,title,description,username")
   .eq("media_type",kind)
   .order("created_at",{ascending:false}).order("id",{ascending:false})
   .range((page-1)*limit,page*limit-1);
 if(error)throw new Error("Media directory temporarily unavailable");
 const rows=data??[];
 const path=kind==="video"?"/videos":"/images";
 return <div className="min-h-screen bg-[#0b0d10] text-white">
  <DesktopShell/><MobileChrome/>
  <main className="mx-auto w-full max-w-[1140px] px-4 pb-28 pt-[90px] sm:px-8 lg:pl-[100px] lg:pt-14">
   <header className="mb-8">
    <h1 className="text-2xl font-semibold tracking-tight">
     {kind==="video"?"Discover videos":"Discover images"}
    </h1>
    <p className="mt-2 text-sm text-white/55">
     New public {kind==="video"?"videos":"images"} shared by creators on Goon Gram.
    </p>
   </header>
   <nav aria-label="Media types" className="mb-6 flex gap-5 text-sm">
    <a className={kind==="video"?"text-white font-semibold":"text-white/50"} href="/videos">Videos</a>
    <a className={kind==="image"?"text-white font-semibold":"text-white/50"} href="/images">Images</a>
    <a className="text-white/50" href="/creators">Creators</a>
   </nav>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {rows.map(row=>{
      const title=mediaTitle(row.title,row.description,kind,row.id);
      const image=publicHttps(publicMediaUrl(kind==="video"?row.thumbnail_path:row.storage_path));
      const href=absolute(`${kind==="video"?"/watch":"/image"}/${row.id}`);
      const owner=row.username;
      return <article key={row.id} className="min-w-0 overflow-hidden rounded-lg border border-white/[.09] bg-white/[.025]">
       <a href={href} className="block">
        {image?<img src={image} alt={title} loading="lazy" className="aspect-square w-full object-cover"/>:
         <div className="flex aspect-square items-center justify-center bg-white/[.04] text-xs text-white/45">Video</div>}
        <h2 className="truncate px-3 pt-3 text-[13px] font-semibold">{title}</h2>
       </a>
       {owner&&<a href={`/${encodeURIComponent(owner)}`}
         className="block truncate px-3 pb-3 pt-1 text-[11px] text-white/50 hover:text-white">@{owner}</a>}
      </article>;
    })}
   </div>
   {rows.length===0&&<p className="py-20 text-sm text-white/50">No public {kind==="video"?"videos":"images"} on this page.</p>}
   <nav aria-label="Browse media pages" className="mt-10 flex justify-between border-t border-white/10 pt-6 text-sm">
    {page>1?<a className="hover:underline" href={page===2?path:`${path}?page=${page-1}`}>Previous page</a>:<span/>}
    {rows.length===limit?<a className="hover:underline" href={`${path}?page=${page+1}`}>Next page</a>:<span/>}
   </nav>
  </main>
 </div>;
}
