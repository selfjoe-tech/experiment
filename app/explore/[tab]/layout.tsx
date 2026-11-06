import type { Metadata } from "next";
import { absolute } from "@/lib/seo/public";
type Props={children:React.ReactNode;params:Promise<{tab:string}>};
const data:Record<string,{name:string;description:string}>={
 gifs:{name:"Videos",description:"Discover public creator videos on Goon Gram."},
 images:{name:"Images",description:"Browse public images shared by Goon Gram creators."},
 creators:{name:"Creators",description:"Discover public creators and their posts on Goon Gram."},
 niches:{name:"Niches",description:"Explore topics and communities with public videos and images."},
};
export async function generateMetadata({params}:Omit<Props,"children">):Promise<Metadata>{
 const {tab}=await params;const info=data[tab];
 if(!info)return {robots:{index:false,follow:false}};
 const canonical=absolute(`/explore/${tab}`);
 return {title:`Explore ${info.name}`,description:info.description,alternates:{canonical},
  robots:{index:true,follow:true},openGraph:{type:"website",title:`Explore ${info.name}`,description:info.description,url:canonical}};
}
export default function ExploreTabLayout({children}:Props){return children;}
