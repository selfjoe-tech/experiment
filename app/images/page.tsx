import type {Metadata} from "next";
import PublicMediaDirectory from "@/app/components/seo/PublicMediaDirectory";
export async function generateMetadata({searchParams}:{searchParams:Promise<{page?:string}>}):Promise<Metadata>{
 const raw=(await searchParams).page;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 return {
  title: page>1 ? "Discover images — Page "+page : "Discover images",
  description:"Browse public creator images on Goon Gram.",
  alternates:{canonical:"https://goongram.com/images"+(page>1?"?page="+page:"")},
  robots:{index:true,follow:true},
 };
}
export const revalidate=300;
export default async function Images({searchParams}:{searchParams:Promise<{page?:string}>}){
 const raw=(await searchParams).page;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 return <PublicMediaDirectory kind="image" page={page}/>;
}
