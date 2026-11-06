import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { indexNowKey } from "@/lib/server/indexNow";
import PosterBackfillButton from "./PosterBackfillButton";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"SEO monitoring",robots:{index:false,follow:false}};

async function rowCount(table:string,filter?:(query:any)=>any) {
  let query=getSupabaseAdmin().from(table).select("id",{count:"exact",head:true});
  if(filter)query=filter(query);
  const {count,error}=await query;
  if(error)throw error;
  return count||0;
}
const fmt=(n:number)=>new Intl.NumberFormat("en-US").format(n);
export default async function SeoAdminPage(){
  await requireAdmin();
  const client=getSupabaseAdmin();
  const [profiles,videos,images,missingPosters,waiting,failed,events]=await Promise.all([
    rowCount("public_seo_profiles"),
    rowCount("public_seo_media",q=>q.eq("media_type","video")),
    rowCount("public_seo_media",q=>q.eq("media_type","image")),
    rowCount("public_seo_media",q=>q.eq("media_type","video").is("thumbnail_path",null)),
    rowCount("seo_discovery_events",q=>q.eq("status","queued")),
    rowCount("seo_discovery_events",q=>q.eq("status","failed")),
    client.from("seo_discovery_events").select("id,canonical_url,kind,status,attempts,last_error,updated_at")
      .order("updated_at",{ascending:false}).limit(30),
  ]);
  if(events.error)throw events.error;
  return <div className="mx-auto max-w-6xl pb-20 text-white">
    <h1 className="text-2xl font-semibold tracking-tight">SEO monitoring</h1>
    <p className="mt-2 text-sm text-white/55">
      Public eligibility, discovery events and publisher-notification status.
      These counts do not mean Google or Bing have indexed the pages.
    </p>
    <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {[
        ["Public creators",profiles],["Public videos",videos],["Public images",images],
        ["Videos without posters",missingPosters],
        ["Queued notifications",waiting],["Failed notifications",failed],
      ].map(([label,value])=><div key={label} className="rounded-lg border border-white/10 bg-white/[.035] p-4">
        <p className="text-xs text-white/55">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{fmt(Number(value))}</p>
      </div>)}
    </div>
    {missingPosters>0&&<PosterBackfillButton/>}
    <div className="mt-7 border-b border-white/10 pb-6 text-sm">
      <h2 className="font-semibold">Search engine integrations</h2>
      <p className="mt-2 text-white/60">IndexNow: {indexNowKey()?"Configured":"Not configured"}</p>
      <p className="mt-2 text-white/60">Google Search Console and Bing indexing confirmation must be checked in their own dashboards.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/75">
        <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Sitemap index</a>
        <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">robots.txt</a>
      </div>
    </div>
    <h2 className="mt-7 text-base font-semibold">Recent discovery events</h2>
    <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead className="border-b border-white/10 text-white/55">
          <tr><th className="p-3">Page</th><th className="p-3">Type</th>
            <th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Updated</th></tr>
        </thead>
        <tbody>{(events.data||[]).map(item=><tr key={item.id} className="border-b border-white/[.06]">
          <td className="max-w-[410px] truncate p-3"><a href={item.canonical_url} className="hover:underline">{item.canonical_url}</a>
            {item.last_error&&<p className="mt-1 text-rose-300/85">{item.last_error}</p>}
          </td>
          <td className="p-3 text-white/60">{item.kind}</td>
          <td className="p-3">{item.status}</td>
          <td className="p-3">{item.attempts}</td>
          <td className="p-3 text-white/50">{new Date(item.updated_at).toLocaleString("en-ZA")}</td>
        </tr>)}</tbody>
      </table>
      {!events.data?.length&&<p className="p-5 text-sm text-white/50">No publishing notifications recorded yet.</p>}
    </div>
  </div>;
}
