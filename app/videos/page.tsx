import type {Metadata} from "next";
import PublicMediaDirectory from "@/app/components/seo/PublicMediaDirectory";
export const metadata:Metadata={
 title:"Discover videos",description:"Browse public creator videos on Goon Gram.",
 alternates:{canonical:"https://goongram.com/videos"},
 robots:{index:true,follow:true},
};
export const revalidate=300;
export default async function Videos({searchParams}:{searchParams:Promise<{page?:string}>}){
 const raw=(await searchParams).page;
 const page=raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Number(raw):1;
 return <PublicMediaDirectory kind="video" page={page}/>;
}
