"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PosterBackfillButton(){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function run(){
    if(busy)return;
    setBusy(true);setMessage("Generating posters...");
    let completed=0;
    try{
      for(let i=0;i<10;i++){
        const res=await fetch("/api/admin/seo/backfill",{
          method:"POST",credentials:"same-origin"
        });
        const result=await res.json();
        if(!res.ok)throw new Error(result.error||"Backfill failed");
        if(result.done){
          setMessage(result.warning||`Completed ${completed} video poster(s).`);
          break;
        }
        completed++;
        setMessage(`Generated ${completed} poster(s)...`);
      }
      router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Backfill failed");}
    finally{setBusy(false);}
  }
  return <div className="mt-4">
    <button type="button" disabled={busy} onClick={()=>{void run();}}
      className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40">
      {busy?"Generating posters...":"Generate missing video posters"}
    </button>
    {message&&<p role="status" className="mt-2 text-xs text-white/60">{message}</p>}
  </div>;
}
