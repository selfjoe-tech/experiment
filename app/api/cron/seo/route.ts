import { deliverIndexNowBatch } from "@/lib/server/indexNow";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)
    return Response.json({error:"Unauthorized"},{status:401});
  try{return Response.json(await deliverIndexNowBatch());}
  catch(e){console.error("SEO retry failed",e);
    return Response.json({error:"Retry failed"},{status:503});}
}
