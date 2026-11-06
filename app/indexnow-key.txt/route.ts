import { indexNowKey } from "@/lib/server/indexNow";
export const dynamic="force-dynamic";
export function GET(){
  const key=indexNowKey();
  return key
    ?new Response(key,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=3600"}})
    :new Response("Not configured",{status:404,headers:{"Cache-Control":"no-store"}});
}
