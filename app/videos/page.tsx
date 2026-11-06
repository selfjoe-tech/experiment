import type {Metadata} from "next";
import PublicMediaDirectory from "@/app/components/seo/PublicMediaDirectory";
export async function generateMetadata({searchParams}:{searchParams:Promise<{page?:string}>}):Promise<Metadata>{
 const raw=(await searchParams).page;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 return {
  title: page>1 ? "Discover videos — Page "+page : "Discover videos",
  description:"Browse public creator videos on Goon Gram.",
  alternates:{canonical:"https://goongram.com/videos"+(page>1?"?page="+page:"")},
  robots:{index:true,follow:true},
 };
}
export const revalidate=300;
export default async function Videos({searchParams}:{searchParams:Promise<{page?:string}>}){
 const raw=(await searchParams).page;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 return <PublicMediaDirectory kind="video" page={page}/>;
}
